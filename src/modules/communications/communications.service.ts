import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { Prisma, CommunicationStatus, RecipientStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CommunicationQueryDto } from './dto/communication-query.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { BroadcastService } from './services/broadcast.service';
import { RecipientService } from './services/recipient.service';
import { StatisticsService } from './services/statistics.service';
import { SchedulerService } from './services/scheduler.service';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: BroadcastService,
    private readonly recipientService: RecipientService,
    private readonly statisticsService: StatisticsService,
    private readonly schedulerService: SchedulerService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Create a communication.
   */
  async create(dto: CreateBroadcastDto) {
    const exists = await this.prisma.communication.findFirst({
      where: {
        title: dto.title,
        deletedAt: null,
      },
    });

    if (exists) {
      throw new ConflictException(
        'A communication with this title already exists.',
      );
    }

    // Determine initial status based on presence of scheduledAt
    const initialStatus = dto.scheduledAt
      ? CommunicationStatus.SCHEDULED
      : CommunicationStatus.DRAFT;

    const communication = await this.prisma.communication.create({
      data: {
        title: dto.title,
        subject: dto.subject,
        content: dto.content,
        type: dto.type,
        status: initialStatus,
        scheduledAt: dto.scheduledAt,
        createdById: dto.createdById,
      },
    });

    if (dto.recipients) {
      const resolved = await this.recipientService.resolveRecipients(
        dto.recipients,
      );

      const uniqueRecipients = this.recipientService.removeDuplicates(resolved);

      await this.recipientService.attachRecipients(
        communication.id,
        uniqueRecipients,
      );
    }

    // Trigger Scheduler if a time was provided at creation
    if (
      communication.status === CommunicationStatus.SCHEDULED &&
      communication.scheduledAt
    ) {
      await this.schedulerService.scheduleJob(
        communication.id,
        communication.scheduledAt,
      );
    }

    this.logger.log(`Communication created (${communication.id})`);

    // Notifications & Auditing
    await this.notificationService.notifyAdmins({
      title: 'New Communication Created',
      message: `A new communication "${communication.title}" has been created.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: dto.createdById ?? undefined },
      {
        action: AuditAction.CREATE_COMMUNICATION,
        entity: 'Communication',
        entityId: communication.id,
        description: `Created communication "${communication.title}"`,
        newValues: communication,
      },
    );

    return this.findOne(communication.id);
  }

  /**
   * List communications.
   */
  async findAll(query: CommunicationQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CommunicationWhereInput = {
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.search) {
      where.OR = [
        {
          title: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          subject: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.communication.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          recipients: true,
        },
      }),

      this.prisma.communication.count({
        where,
      }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get one communication.
   */
  async findOne(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      include: {
        recipients: true,
        logs: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('Communication not found.');
    }

    return communication;
  }

  /**
   * Update a communication.
   */
  async update(id: string, dto: UpdateBroadcastDto, userId?: string) {
    const current = await this.findOne(id);

    const updated = await this.prisma.communication.update({
      where: { id },
      data: {
        title: dto.title,
        subject: dto.subject,
        content: dto.content,
        type: dto.type,
        scheduledAt: dto.scheduledAt,
      },
      include: {
        recipients: true,
        logs: true,
      },
    });

    // Handle rescheduling updates if already scheduled
    if (updated.status === CommunicationStatus.SCHEDULED) {
      await this.schedulerService.cancelJob(id);
      if (updated.scheduledAt) {
        await this.schedulerService.scheduleJob(id, updated.scheduledAt);
      }
    }

    this.logger.log(`Communication updated (${id})`);

    // Notifications & Auditing
    await this.notificationService.notifyAdmins({
      title: 'Communication Updated',
      message: `Communication "${updated.title}" has been updated.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? updated.createdById ?? undefined },
      {
        action: AuditAction.UPDATE_COMMUNICATION,
        entity: 'Communication',
        entityId: updated.id,
        description: `Updated communication "${updated.title}"`,
        oldValues: current,
        newValues: updated,
      },
    );

    return updated;
  }

  /**
   * Soft delete communication.
   */
  async remove(id: string, userId?: string) {
    const current = await this.findOne(id);

    // Cancel active jobs before dropping
    await this.schedulerService.cancelJob(id);

    const deleted = await this.prisma.communication.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: CommunicationStatus.CANCELLED,
      },
    });

    this.logger.log(`Communication soft-deleted (${id})`);

    await this.notificationService.notifyAdmins({
      title: 'Communication Deleted',
      message: `"${current.title}" (${id}) has been deleted.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.DELETE_COMMUNICATION,
        entity: 'Communication',
        entityId: id,
        description: `Communication "${current.title}" deleted`,
        oldValues: current,
        newValues: deleted,
      },
    );

    return { message: 'Communication soft-deleted successfully.' };
  }

  /**
   * Restore soft-deleted communication.
   */
  async restore(id: string, userId?: string) {
    const restored = await this.prisma.communication.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    });

    this.logger.log(`Communication restored (${id})`);

    await this.notificationService.notifyAdmins({
      title: 'Communication Restored',
      message: `Communication "${restored.title}" has been restored.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.RESTORE_COMMUNICATION,
        entity: 'Communication',
        entityId: id,
        description: `Communication "${restored.title}" restored`,
        newValues: restored,
      },
    );

    return this.findOne(id);
  }

  /**
   * Archive communication.
   */
  async archive(id: string, userId?: string) {
    const current = await this.findOne(id);

    await this.schedulerService.cancelJob(id);

    const archived = await this.prisma.communication.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });

    this.logger.log(`Communication archived (${id})`);

    await this.notificationService.notifyAdmins({
      title: 'Communication Archived',
      message: `Communication "${current.title}" has been archived.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.ARCHIVE_COMMUNICATION,
        entity: 'Communication',
        entityId: id,
        description: `Communication "${current.title}" archived`,
        oldValues: current,
        newValues: archived,
      },
    );

    return { message: 'Communication archived successfully.' };
  }

  /**
   * Duplicate an existing communication.
   */
  async duplicate(id: string, userId?: string) {
    const communication = await this.findOne(id);

    const duplicate = await this.prisma.communication.create({
      data: {
        title: `${communication.title} (Copy)`,
        subject: communication.subject,
        content: communication.content,
        type: communication.type,
        status: CommunicationStatus.DRAFT,
        createdById: userId ?? communication.createdById,
        recipients: {
          create: communication.recipients.map((recipient) => ({
            memberId: recipient.memberId,
            email: recipient.email,
            phone: recipient.phone,
            status: RecipientStatus.PENDING,
          })),
        },
      },
      include: {
        recipients: true,
      },
    });

    this.logger.log(`Communication duplicated (${id})`);

    await this.notificationService.notifyAdmins({
      title: 'Communication Duplicated',
      message: `Communication "${communication.title}" has been duplicated.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? duplicate.createdById ?? undefined },
      {
        action: AuditAction.DUPLICATE_COMMUNICATION,
        entity: 'Communication',
        entityId: duplicate.id,
        description: `Duplicated communication "${communication.title}"`,
        newValues: duplicate,
      },
    );

    return duplicate;
  }

  /**
   * Preview communication before sending.
   */
  async preview(id: string) {
    const communication = await this.findOne(id);

    return {
      title: communication.title,
      subject: communication.subject,
      content: communication.content,
      type: communication.type,
      status: communication.status,
      recipients: communication.recipients.length,
      scheduledAt: communication.scheduledAt,
    };
  }

  /**
   * Preview recipients.
   */
  async previewRecipients(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      include: {
        recipients: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('Communication not found.');
    }

    return {
      total: communication.recipients.length,
      recipients: communication.recipients,
    };
  }

  /**
   * Send newsletter.
   */
  async sendNewsletter(id: string, dto: SendNewsletterDto, userId?: string) {
    const communication = await this.findOne(id);

    if (communication.status === CommunicationStatus.SENT) {
      throw new ConflictException('Newsletter has already been sent.');
    }

    // Cancel scheduler job if manual override is triggered
    await this.schedulerService.cancelJob(id);

    if (dto.subject) {
      await this.prisma.communication.update({
        where: { id },
        data: { subject: dto.subject },
      });
    }

    const result = await this.broadcastService.send(id);

    await this.notificationService.notifyAdmins({
      title: 'Newsletter Sent',
      message: `"${communication.title}" has been sent successfully.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.SEND_NEWSLETTER,
        entity: 'Communication',
        entityId: id,
        description: `Newsletter "${communication.title}" sent`,
        metadata: result,
      },
    );

    return result;
  }

  /**
   * Send broadcast notification.
   */
  async sendNotification(id: string, dto: SendNotificationDto, userId?: string) {
    const communication = await this.findOne(id);

    if (communication.status === CommunicationStatus.SENT) {
      throw new ConflictException('Communication has already been sent.');
    }

    // Cancel scheduler job if manual override is triggered
    await this.schedulerService.cancelJob(id);

    const result = await this.broadcastService.send(id);

    await this.notificationService.notifyAdmins({
      title: 'Broadcast Sent',
      message: `"${communication.title}" broadcast completed.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.SEND_COMMUNICATION,
        entity: 'Communication',
        entityId: id,
        description: `Broadcast "${communication.title}" sent`,
        metadata: result,
      },
    );

    return result;
  }

  /**
   * Schedule communication.
   */
  async schedule(id: string, userId?: string) {
    const communication = await this.findOne(id);

    if (communication.status === CommunicationStatus.SENT) {
      throw new ConflictException('Communication has already been sent.');
    }

    if (!communication.scheduledAt) {
      throw new ConflictException('scheduledAt is required before scheduling.');
    }

    await this.prisma.communication.update({
      where: { id },
      data: { status: CommunicationStatus.SCHEDULED },
    });

    // Register job into memory/cron engine
    await this.schedulerService.scheduleJob(id, communication.scheduledAt);

    this.logger.log(`Communication scheduled (${id})`);

    await this.notificationService.notifyAdmins({
      title: 'Communication Scheduled',
      message: `"${communication.title}" scheduled for ${communication.scheduledAt}.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.SCHEDULE_COMMUNICATION,
        entity: 'Communication',
        entityId: id,
        description: `Scheduled "${communication.title}"`,
      },
    );

    return { message: 'Communication scheduled successfully.' };
  }

  /**
   * Cancel scheduled communication.
   */
  async cancel(id: string, userId?: string) {
    const communication = await this.findOne(id);

    if (communication.status !== CommunicationStatus.SCHEDULED) {
      throw new ConflictException('Communication is not scheduled.');
    }

    await this.prisma.communication.update({
      where: { id },
      data: { status: CommunicationStatus.DRAFT },
    });

    // Kill active cron/timeout hooks cleanly
    await this.schedulerService.cancelJob(id);

    this.logger.log(`Scheduled communication cancelled (${id})`);

    await this.notificationService.notifyAdmins({
      title: 'Scheduled Communication Cancelled',
      message: `"${communication.title}" scheduling has been cancelled.`,
      type: NotificationType.SYSTEM,
    });

    await this.auditLogService.createLog(
      { id: userId ?? undefined },
      {
        action: AuditAction.CANCEL_COMMUNICATION,
        entity: 'Communication',
        entityId: id,
        description: `Cancelled scheduled communication "${communication.title}"`,
      },
    );

    return { message: 'Scheduled communication cancelled.' };
  }

  /**
   * Communication statistics.
   */
  async statistics(id: string) {
    await this.findOne(id);
    return this.statisticsService.getCommunicationStatistics(id);
  }
}