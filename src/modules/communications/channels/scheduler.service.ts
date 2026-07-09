import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BroadcastService } from '../services/broadcast.service';
import { CommunicationStatus } from '../enums/communication-status.enum';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private isProcessingBatch = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: BroadcastService,
  ) {}

  onModuleInit() {
    this.logger.log('Scheduler Service background engine initialized for Communication models.');
  }

  /**
   * Background polling worker running every minute.
   * Pulls matching records using the strict `this.prisma.communication` pipeline.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledTicker() {
    if (this.isProcessingBatch) {
      this.logger.warn('Previous broadcast ticker iteration is still running. Skipping block.');
      return;
    }

    this.isProcessingBatch = true;
    const now = new Date();

    try {
      // Safely queries against your exact model definition matching context references
      const dueCommunications = await this.prisma.communication.findMany({
        where: {
          status: CommunicationStatus.SCHEDULED,
          scheduledAt: {
            lte: now, // scheduledAt <= current execution timestamp
          },
        },
        select: { id: true, title: true },
        take: 10, // Chunk limits prevent heavy Vercel serverless execution load spikes
      });

      if (dueCommunications.length === 0) {
        this.isProcessingBatch = false;
        return;
      }

      this.logger.log(`Found ${dueCommunications.length} scheduled communications ready to broadcast.`);

      for (const communication of dueCommunications) {
        try {
          this.logger.log(`Executing distribution pipeline for: "${communication.title}" (${communication.id})`);
          await this.broadcastService.send(communication.id);
        } catch (broadcastError: any) {
          this.logger.error(
            `Failed to execute scheduled communication ${communication.id}: ${broadcastError.message}`,
            broadcastError.stack,
          );
          
          await this.prisma.communication.update({
            where: { id: communication.id },
            data: { status: CommunicationStatus.FAILED },
          });
        }
      }
    } catch (criticalSystemError: any) {
      this.logger.error(`Critical failure inside communication scheduler worker: ${criticalSystemError.message}`);
    } finally {
      this.isProcessingBatch = false;
    }
  }

  /**
   * Utility query accessor to assert current dispatch targets
   */
  async getScheduleStatus(id: string) {
    const record = await this.prisma.communication.findUnique({
      where: { id },
      select: { status: true, scheduledAt: true },
    });

    return {
      isScheduled: record?.status === CommunicationStatus.SCHEDULED,
      scheduledAt: record?.scheduledAt || null,
    };
  }
}