import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { Cron, CronExpression } from '@nestjs/schedule';

import { createHash } from 'crypto';

import { PrismaService } from '../../../prisma/prisma.service';

import {
  AnalyticsResult,
  TrackAnalyticsEventDto,
} from '../../../types/visits';

@Injectable()
export class WebAnalyticsService {
  private readonly logger = new Logger(
    WebAnalyticsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Hash an IP address before storing it.
   *
   * We don't need to store the user's raw IP
   * address for basic analytics.
   */
  private hashIp(
    ip?: string,
  ): string | null {
    if (!ip) {
      return null;
    }

    return createHash('sha256')
      .update(ip)
      .digest('hex');
  }

  /**
   * Track a website event.
   */
  async trackEvent(
    data: TrackAnalyticsEventDto,
    ip?: string,
  ): Promise<void> {
    try {
      /**
       * Find or create the visitor.
       */
      const visitor =
        await this.prisma.webAnalyticsVisitor.upsert(
          {
            where: {
              visitorId:
                data.visitorId,
            },

            update: {
              lastSeenAt:
                new Date(),
            },

            create: {
              visitorId:
                data.visitorId,
            },
          },
        );

      /**
       * Find or create the session.
       */
      const session =
        await this.prisma.webAnalyticsSession.upsert(
          {
            where: {
              sessionId:
                data.sessionId,
            },

            update: {
              lastSeenAt:
                new Date(),

              userAgent:
                data.browser ||
                undefined,

              country:
                data.country ||
                undefined,

              city:
                data.city ||
                undefined,

              device:
                data.device ||
                undefined,

              browser:
                data.browser ||
                undefined,

              os:
                data.os ||
                undefined,

              referrer:
                data.referrer ||
                undefined,
            },

            create: {
              sessionId:
                data.sessionId,

              visitorId:
                visitor.visitorId,

              ipHash:
                this.hashIp(ip),

              userAgent:
                data.browser ||
                undefined,

              country:
                data.country ||
                undefined,

              city:
                data.city ||
                undefined,

              device:
                data.device ||
                undefined,

              browser:
                data.browser ||
                undefined,

              os:
                data.os ||
                undefined,

              referrer:
                data.referrer ||
                undefined,
            },
          },
        );

      /**
       * Store the actual analytics event.
       */
      await this.prisma.webAnalyticsEvent.create(
        {
          data: {
            event:
              data.event,

            path:
              data.path ||
              undefined,

            title:
              data.title ||
              undefined,

            url:
              data.url ||
              undefined,

            visitorId:
              visitor.visitorId,

            sessionId:
              session.sessionId,
          },
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to record analytics event.',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to record analytics event.',
      );
    }
  }

  /**
   * Get analytics for a period.
   */
  async getVisitorBreakdown(
    days = 30,
  ): Promise<AnalyticsResult> {
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

    const now =
      new Date();

    const startAt =
      new Date();

    startAt.setDate(
      startAt.getDate() -
        normalizedDays,
    );

    /**
     * Total unique visitors.
     */
    const totalVisitors =
      await this.prisma.webAnalyticsEvent.findMany(
        {
          where: {
            createdAt: {
              gte: startAt,
              lte: now,
            },

            visitorId: {
              not: null,
            },
          },

          distinct: [
            'visitorId',
          ],

          select: {
            visitorId: true,
          },
        },
      );

    /**
     * Total sessions/visits.
     */
    const totalVisits =
      await this.prisma.webAnalyticsSession.count(
        {
          where: {
            startedAt: {
              gte: startAt,
              lte: now,
            },
          },
        },
      );

    /**
     * Total pageviews.
     */
    const totalPageviews =
      await this.prisma.webAnalyticsEvent.count(
        {
          where: {
            createdAt: {
              gte: startAt,
              lte: now,
            },

            event:
              'page_view',
          },
        },
      );

    /**
     * Determine first-time visitors.
     */
    const newVisitorRecords =
      await this.prisma.webAnalyticsVisitor.findMany(
        {
          where: {
            firstSeenAt: {
              gte: startAt,
              lte: now,
            },
          },

          select: {
            visitorId: true,
          },
        },
      );

    const newVisitorIds =
      new Set(
        newVisitorRecords.map(
          (visitor) =>
            visitor.visitorId,
        ),
      );

    const newVisitors =
      totalVisitors.filter(
        (visitor) =>
          visitor.visitorId &&
          newVisitorIds.has(
            visitor.visitorId,
          ),
      ).length;

    /**
     * Returning visitors are visitors
     * who visited before the current period.
     */
    const returningVisitors =
      totalVisitors.length -
      newVisitors;

    /**
     * Previous period.
     */
    const previousPeriodEnd =
      new Date(startAt);

    previousPeriodEnd.setMilliseconds(
      previousPeriodEnd.getMilliseconds() -
        1,
    );

    const previousPeriodStart =
      new Date(
        previousPeriodEnd,
      );

    previousPeriodStart.setDate(
      previousPeriodStart.getDate() -
        normalizedDays,
    );

    const previousVisitors =
      await this.prisma.webAnalyticsEvent.findMany(
        {
          where: {
            createdAt: {
              gte:
                previousPeriodStart,

              lte:
                previousPeriodEnd,
            },

            visitorId: {
              not: null,
            },
          },

          distinct: [
            'visitorId',
          ],

          select: {
            visitorId: true,
          },
        },
      );

    const visitorsChangePercent =
      previousVisitors.length > 0
        ? Number(
            (
              (
                (
                  totalVisitors.length -
                  previousVisitors.length
                ) /
                previousVisitors.length
              ) *
              100
            ).toFixed(1),
          )
        : null;

    return {
      newVisitors,

      returningVisitors,

      totalVisitors:
        totalVisitors.length,

      totalVisits,

      totalPageviews,

      visitorsChangePercent,

      periodDays:
        normalizedDays,

      source:
        'database',
    };
  }

  /**
   * Generate today's daily snapshot.
   *
   * This is useful for historical dashboard
   * reporting and faster queries.
   */
  async syncDailySnapshot(
    targetDate = new Date(),
  ): Promise<void> {
    const startOfDay =
      new Date(targetDate);

    startOfDay.setHours(
      0,
      0,
      0,
      0,
    );

    const endOfDay =
      new Date(targetDate);

    endOfDay.setHours(
      23,
      59,
      59,
      999,
    );

    try {
      const visitors =
        await this.prisma.webAnalyticsEvent.findMany(
          {
            where: {
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },

              visitorId: {
                not: null,
              },
            },

            distinct: [
              'visitorId',
            ],

            select: {
              visitorId: true,
            },
          },
        );

      const totalVisits =
        await this.prisma.webAnalyticsSession.count(
          {
            where: {
              startedAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          },
        );

      const totalPageviews =
        await this.prisma.webAnalyticsEvent.count(
          {
            where: {
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },

              event:
                'page_view',
            },
          },
        );

      const newVisitors =
        await this.prisma.webAnalyticsVisitor.count(
          {
            where: {
              firstSeenAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          },
        );

      const totalVisitors =
        visitors.length;

      const returningVisitors =
        Math.max(
          totalVisitors -
            newVisitors,
          0,
        );

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

            returningVisits:
              returningVisitors,
          },

          create: {
            date:
              startOfDay,

            totalVisitors,

            totalVisits,

            totalPageviews,

            newVisitors,

            returningVisits:
              returningVisitors,
          },
        },
      );

      this.logger.log(
        `Analytics snapshot generated for ${
          startOfDay
            .toISOString()
            .split('T')[0]
        }`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to generate analytics snapshot.',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  /**
   * Automatically generate yesterday's
   * completed analytics snapshot.
   */
  @Cron(
    CronExpression.EVERY_DAY_AT_MIDNIGHT,
  )
  async handleDailyAnalyticsCron(): Promise<void> {
    this.logger.log(
      'Running daily analytics snapshot...',
    );

    const yesterday =
      new Date();

    yesterday.setDate(
      yesterday.getDate() -
        1,
    );

    try {
      await this.syncDailySnapshot(
        yesterday,
      );
    } catch (error) {
      this.logger.error(
        'Daily analytics snapshot failed.',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }
}