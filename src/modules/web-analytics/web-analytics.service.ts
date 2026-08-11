import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../../prisma/prisma.service';

import {
  UmamiStatsResponse,
  AnalyticsResult,
} from '../../../types/visits';

@Injectable()
export class WebAnalyticsService {
  private readonly logger = new Logger(
    WebAnalyticsService.name,
  );

  private readonly apiKey: string | undefined;
  private readonly websiteId: string | undefined;
  private readonly apiBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey =
      this.configService.get<string>(
        'UMAMI_API_KEY',
      );

    this.websiteId =
      this.configService.get<string>(
        'UMAMI_WEBSITE_ID',
      );

    this.apiBase =
      this.configService.get<string>(
        'UMAMI_API_BASE',
      ) ?? 'https://api.umami.is/v1';
  }

  /**
   * Make sure Umami is properly configured.
   */
  private assertConfigured(): void {
    if (!this.apiKey || !this.websiteId) {
      throw new InternalServerErrorException(
        'Website analytics is not configured. Please set UMAMI_API_KEY and UMAMI_WEBSITE_ID.',
      );
    }
  }

  /**
   * Headers used when communicating with Umami.
   */
  private getHeaders(): HeadersInit {
    this.assertConfigured();

    return {
      Accept: 'application/json',
      'x-umami-api-key': this.apiKey!,
    };
  }

  /**
   * Fetch statistics from Umami.
   */
  private async fetchUmamiStats(
    startAt: number,
    endAt: number,
  ): Promise<UmamiStatsResponse> {
    this.assertConfigured();

    const url = new URL(
      `${this.apiBase}/websites/${this.websiteId}/stats`,
    );

    url.searchParams.set(
      'startAt',
      String(startAt),
    );

    url.searchParams.set(
      'endAt',
      String(endAt),
    );

    let response: Response;

    try {
      response = await fetch(
        url.toString(),
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
      );
    } catch (error) {
      this.logger.error(
        'Unable to connect to Umami API',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to connect to website analytics service.',
      );
    }

    if (!response.ok) {
      const responseText =
        await response.text().catch(
          () => '',
        );

      this.logger.error(
        `Umami API returned ${response.status}: ${responseText}`,
      );

      throw new InternalServerErrorException(
        `Website analytics service returned HTTP ${response.status}.`,
      );
    }

    try {
      return (await response.json()) as UmamiStatsResponse;
    } catch (error) {
      this.logger.error(
        'Failed to parse Umami API response',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Invalid response received from website analytics service.',
      );
    }
  }

  /**
   * Get the beginning of a day.
   */
  private startOfDay(date: Date): Date {
    const result = new Date(date);

    result.setHours(
      0,
      0,
      0,
      0,
    );

    return result;
  }

  /**
   * Get the end of a day.
   */
  private endOfDay(date: Date): Date {
    const result = new Date(date);

    result.setHours(
      23,
      59,
      59,
      999,
    );

    return result;
  }

  /**
   * Sync one day's analytics from Umami
   * into PostgreSQL.
   */
  async syncDailySnapshot(
    targetDate = new Date(),
  ): Promise<void> {
    this.assertConfigured();

    const startOfDay =
      this.startOfDay(targetDate);

    const endOfDay =
      this.endOfDay(targetDate);

    try {
      const stats =
        await this.fetchUmamiStats(
          startOfDay.getTime(),
          endOfDay.getTime(),
        );

      const totalVisitors =
        Number(stats.visitors ?? 0);

      const totalVisits =
        Number(stats.visits ?? 0);

      const totalPageviews =
        Number(stats.pageviews ?? 0);

      /**
       * At this stage, the standard Umami
       * stats endpoint does not give us a
       * reliable unique returning-visitor
       * count.
       *
       * Therefore we don't incorrectly calculate:
       *
       * totalVisits - totalVisitors
       *
       * as returning visitors.
       */
      const newVisitors =
        totalVisitors;

      const returningVisits = 0;

      await this.prisma.webAnalyticsSnapshot.upsert(
        {
          where: {
            date: startOfDay,
          },

          update: {
            totalVisitors,
            totalVisits,
            totalPageviews,
            newVisitors,
            returningVisits,
          },

          create: {
            date: startOfDay,
            totalVisitors,
            totalVisits,
            totalPageviews,
            newVisitors,
            returningVisits,
          },
        },
      );

      this.logger.log(
        `Analytics snapshot synced successfully for ${
          startOfDay
            .toISOString()
            .split('T')[0]
        }`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync Umami analytics for ${
          startOfDay
            .toISOString()
            .split('T')[0]
        }`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  /**
   * Get visitor analytics.
   *
   * Database snapshots are preferred.
   * If there are no snapshots, Umami is queried directly.
   */
  async getVisitorBreakdown(
    days = 30,
  ): Promise<AnalyticsResult> {
    this.assertConfigured();

    /**
     * Keep the requested range within
     * a reasonable limit.
     */
    const normalizedDays =
      Math.min(
        Math.max(
          Math.floor(
            Number(days) || 30,
          ),
          1,
        ),
        365,
      );

    const endAt = new Date();

    const startAt = new Date();

    startAt.setDate(
      startAt.getDate() -
        normalizedDays,
    );

    startAt.setHours(
      0,
      0,
      0,
      0,
    );

    /**
     * Read saved snapshots.
     */
    const snapshots =
      await this.prisma.webAnalyticsSnapshot.findMany(
        {
          where: {
            date: {
              gte: startAt,
              lte: endAt,
            },
          },

          orderBy: {
            date: 'asc',
          },
        },
      );

    /**
     * If we have database snapshots,
     * calculate the requested period from them.
     */
    if (snapshots.length > 0) {
      const totalVisitors =
        snapshots.reduce(
          (acc, snapshot) =>
            acc +
            snapshot.totalVisitors,
          0,
        );

      const totalVisits =
        snapshots.reduce(
          (acc, snapshot) =>
            acc +
            snapshot.totalVisits,
          0,
        );

      const totalPageviews =
        snapshots.reduce(
          (acc, snapshot) =>
            acc +
            snapshot.totalPageviews,
          0,
        );

      const newVisitors =
        snapshots.reduce(
          (acc, snapshot) =>
            acc +
            snapshot.newVisitors,
          0,
        );

      const returningVisits =
        snapshots.reduce(
          (acc, snapshot) =>
            acc +
            snapshot.returningVisits,
          0,
        );

      /**
       * Calculate the previous equivalent period.
       *
       * Example:
       * Current = last 30 days
       * Previous = 30 days immediately before that
       */
      const previousPeriodStart =
        new Date(startAt);

      previousPeriodStart.setDate(
        previousPeriodStart.getDate() -
          normalizedDays,
      );

      const previousPeriodEnd =
        new Date(startAt);

      previousPeriodEnd.setMilliseconds(
        previousPeriodEnd.getMilliseconds() -
          1,
      );

      const previousSnapshots =
        await this.prisma.webAnalyticsSnapshot.findMany(
          {
            where: {
              date: {
                gte: previousPeriodStart,
                lte: previousPeriodEnd,
              },
            },
          },
        );

      const previousVisitors =
        previousSnapshots.reduce(
          (acc, snapshot) =>
            acc +
            snapshot.totalVisitors,
          0,
        );

      const visitorsChangePercent =
        previousVisitors > 0
          ? Number(
              (
                (
                  (totalVisitors -
                    previousVisitors) /
                  previousVisitors
                ) *
                100
              ).toFixed(1),
            )
          : null;

      return {
        newVisitors,
        returningVisits,
        totalVisitors,
        totalVisits,
        totalPageviews,
        visitorsChangePercent,
        periodDays: normalizedDays,
        source: 'database',
      };
    }

    /**
     * No local snapshots yet.
     *
     * Fetch directly from Umami.
     */
    return this.fetchDirectFromUmami(
      normalizedDays,
    );
  }

  /**
   * Fetch analytics directly from Umami.
   */
  private async fetchDirectFromUmami(
    days: number,
  ): Promise<AnalyticsResult> {
    this.assertConfigured();

    const endAt = Date.now();

    const startAt =
      endAt -
      days *
        24 *
        60 *
        60 *
        1000;

    const stats =
      await this.fetchUmamiStats(
        startAt,
        endAt,
      );

    const totalVisitors =
      Number(stats.visitors ?? 0);

    const totalVisits =
      Number(stats.visits ?? 0);

    const totalPageviews =
      Number(stats.pageviews ?? 0);

    /**
     * UmamiStatsComparison is used here.
     *
     * comparison.visitors represents the
     * previous comparison-period visitor count.
     */
    const previousVisitors =
      Number(
        stats.comparison?.visitors ?? 0,
      );

    const visitorsChangePercent =
      previousVisitors > 0
        ? Number(
            (
              (
                (totalVisitors -
                  previousVisitors) /
                previousVisitors
              ) *
              100
            ).toFixed(1),
          )
        : null;

    const newVisitors =
      totalVisitors;

    const returningVisits = 0;

    return {
      newVisitors,
      returningVisits,
      totalVisitors,
      totalVisits,
      totalPageviews,
      visitorsChangePercent,
      periodDays: days,
      source: 'umami',
    };
  }
}