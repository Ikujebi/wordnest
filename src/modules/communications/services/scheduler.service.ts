import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../../../prisma/prisma.service';
import { BroadcastService } from './broadcast.service';

import { CommunicationStatus } from '@prisma/client'; // 🔥 Import from prisma client directly if enum matches

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: BroadcastService,
  ) {}

  // 🔥 ADDED: No-op placeholder to prevent contract breakdown inside CommunicationsService
  async scheduleJob(id: string, scheduledAt: Date): Promise<void> {
    this.logger.debug(`Job registration requested for ${id} at ${scheduledAt.toISOString()}. Managed via database cron polling.`);
    return;
  }

  // 🔥 ADDED: No-op placeholder to prevent contract breakdown inside CommunicationsService
  async cancelJob(id: string): Promise<void> {
    this.logger.debug(`Job cancellation requested for ${id}. Handled implicitly by state changes in database cron polling.`);
    return;
  }

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
          deletedAt: null,
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
        const err = error as Error;
        this.logger.error(
          `Failed to send communication ${communication.id}`,
          err.stack,
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
          deletedAt: null,
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
      `Archived ${result.count} old sent communication(s).`,
    );
  }

  /**
   * Delete delivery logs older than one year.
   * Runs every week.
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