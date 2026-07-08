import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../../../prisma/prisma.service';
import { BroadcastService } from './broadcast.service';

import { CommunicationStatus } from '../enums/communication-status.enum';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: BroadcastService,
  ) {}

  /**
   * Runs every minute.
   * Sends every scheduled communication whose scheduledAt <= now.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledCommunications(): Promise<void> {
    this.logger.debug('Checking scheduled communications...');

    const communications =
      await this.prisma.communication.findMany({
        where: {
          status: CommunicationStatus.SCHEDULED,
          scheduledAt: {
            lte: new Date(),
          },
        },
      });

    if (!communications.length) {
      return;
    }

    this.logger.log(
      `Found ${communications.length} scheduled communication(s).`,
    );

    for (const communication of communications) {
      try {
        await this.broadcastService.send(communication.id);

        this.logger.log(
          `Communication ${communication.id} sent successfully.`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send communication ${communication.id}`,
          error.stack,
        );

        await this.prisma.communication.update({
          where: {
            id: communication.id,
          },
          data: {
            status: CommunicationStatus.FAILED,
          },
        });
      }
    }
  }

  /**
   * Retry failed communications every hour.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async retryFailedCommunications(): Promise<void> {
    this.logger.debug('Checking failed communications...');

    const failed =
      await this.prisma.communication.findMany({
        where: {
          status: CommunicationStatus.FAILED,
        },
      });

    for (const communication of failed) {
      try {
        await this.broadcastService.retryFailed(
          communication.id,
        );

        this.logger.log(
          `Retry successful for ${communication.id}`,
        );
      } catch (error) {
        this.logger.warn(
          `Retry failed for ${communication.id}`,
        );
      }
    }
  }

  /**
   * Archive old communications.
   *
   * Runs every day at 2AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async archiveOldCommunications(): Promise<void> {
    const cutoff = new Date();

    cutoff.setMonth(cutoff.getMonth() - 6);

    const result =
      await this.prisma.communication.updateMany({
        where: {
          status: CommunicationStatus.SENT,
          sentAt: {
            lt: cutoff,
          },
          archivedAt: null,
        },
        data: {
          archivedAt: new Date(),
        },
      });

    this.logger.log(
      `Archived ${result.count} communication(s).`,
    );
  }

  /**
   * Delete delivery logs older than one year.
   *
   * Runs every Sunday at 3AM.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupLogs(): Promise<void> {
    const cutoff = new Date();

    cutoff.setFullYear(cutoff.getFullYear() - 1);

    const result =
      await this.prisma.communicationLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoff,
          },
        },
      });

    this.logger.log(
      `Deleted ${result.count} old communication logs.`,
    );
  }

  /**
   * Health check.
   * Executes every midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async schedulerHealthCheck(): Promise<void> {
    this.logger.log(
      'Communication scheduler is running normally.',
    );
  }
}