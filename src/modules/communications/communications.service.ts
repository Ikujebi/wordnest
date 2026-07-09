import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { Prisma, CommunicationStatus, RecipientStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CommunicationQueryDto } from './dto/communication-query.dto';

import { BroadcastService } from './services/broadcast.service';
import { RecipientService } from './services/recipient.service';
import { StatisticsService } from './services/statistics.service';
import { SchedulerService } from './services/scheduler.service';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(
    CommunicationsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: BroadcastService,
    private readonly recipientService: RecipientService,
    private readonly statisticsService: StatisticsService,
    private readonly schedulerService: SchedulerService,
  ) {}

  /**
   * Create a communication.
   */
  async create(
    dto: CreateBroadcastDto,
  ) {
    const exists =
      await this.prisma.communication.findFirst({
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

    const communication =
      await this.prisma.communication.create({
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
      const resolved =
        await this.recipientService.resolveRecipients(
          dto.recipients,
        );

      const uniqueRecipients =
        this.recipientService.removeDuplicates(
          resolved,
        );

      await this.recipientService.attachRecipients(
        communication.id,
        uniqueRecipients,
      );
    }

    // 🔥 Trigger Scheduler if a time was provided at creation
    if (communication.status === CommunicationStatus.SCHEDULED && communication.scheduledAt) {
      await this.schedulerService.scheduleJob(communication.id, communication.scheduledAt);
    }

    this.logger.log(
      `Communication created (${communication.id})`,
    );

    return this.findOne(
      communication.id,
    );
  }

  /**
   * List communications.
   */
  async findAll(
    query: CommunicationQueryDto,
  ) {
    const page =
      Number(query.page) || 1;

    const limit =
      Number(query.limit) || 20;

    const skip =
      (page - 1) * limit;

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

    const [
      items,
      total,
    ] =
      await this.prisma.$transaction([
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
        totalPages: Math.ceil(
          total / limit,
        ),
      },
    };
  }

  /**
   * Get one communication.
   */
  async findOne(
    id: string,
  ) {
    const communication =
      await this.prisma.communication.findUnique({
        where: {
          id,
        },
        include: {
          recipients: true,
          logs: true,
        },
      });

    if (!communication) {
      throw new NotFoundException(
        'Communication not found.',
      );
    }

    return communication;
  }

  /**
   * Update a communication.
   */
  async update(
    id: string,
    dto: UpdateBroadcastDto,
  ) {
    const current = await this.findOne(id);

    const updated =
      await this.prisma.communication.update({
        where: {
          id,
        },
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

    // 🔥 Handle rescheduling updates if the communication is already scheduled
    if (updated.status === CommunicationStatus.SCHEDULED) {
      await this.schedulerService.cancelJob(id);
      if (updated.scheduledAt) {
        await this.schedulerService.scheduleJob(id, updated.scheduledAt);
      }
    }

    this.logger.log(
      `Communication updated (${id})`,
    );

    return updated;
  }

  /**
   * Soft delete communication.
   */
  async remove(
    id: string,
  ) {
    await this.findOne(id);

    // 🔥 Cancel any active scheduled cron/jobs before dropping
    await this.schedulerService.cancelJob(id);

    await this.prisma.communication.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
        status: CommunicationStatus.CANCELLED, // Clear status state on delete
      },
    });

    this.logger.log(
      `Communication soft-deleted (${id})`,
    );

    return;
  }

  /**
   * Restore soft-deleted communication.
   */
  async restore(
    id: string,
  ) {
    await this.prisma.communication.update({
      where: {
        id,
      },
      data: {
        deletedAt: null,
      },
    });

    this.logger.log(
      `Communication restored (${id})`,
    );

    return this.findOne(id);
  }

  /**
   * Archive communication using column.
   */
  async archive(
    id: string,
  ) {
    await this.findOne(id);

    // 🔥 Stop jobs on archival tracking safely
    await this.schedulerService.cancelJob(id);

    await this.prisma.communication.update({
      where: {
        id,
      },
      data: {
        archivedAt: new Date(),
      },
    });

    this.logger.log(
      `Communication archived (${id})`,
    );

    return {
      message:
        'Communication archived successfully.',
    };
  }

  /**
   * Duplicate an existing communication.
   */
  async duplicate(
    id: string,
  ) {
    const communication =
      await this.findOne(id);

    const duplicate =
      await this.prisma.communication.create({
        data: {
          title:
            `${communication.title} (Copy)`,
          subject:
            communication.subject,
          content:
            communication.content,
          type:
            communication.type,
          status:
            CommunicationStatus.DRAFT,
          createdById:
            communication.createdById,
          recipients: {
            create:
              communication.recipients.map(
                (recipient) => ({
                  memberId:
                    recipient.memberId,
                  email:
                    recipient.email,
                  phone:
                    recipient.phone,
                  status: 
                    RecipientStatus.PENDING,
                }),
              ),
          },
        },
        include: {
          recipients: true,
        },
      });

    this.logger.log(
      `Communication duplicated (${id})`,
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
    const communication =
      await this.prisma.communication.findUnique({
        where: { id },
        include: {
          recipients: true,
        },
      });

    if (!communication) {
      throw new NotFoundException(
        'Communication not found.',
      );
    }

    return {
      total: communication.recipients.length,
      recipients: communication.recipients,
    };
  }

  /**
   * Send newsletter.
   */
  async sendNewsletter(
    id: string,
    dto: SendNewsletterDto,
  ) {
    const communication = await this.findOne(id);

    if (
      communication.status ===
      CommunicationStatus.SENT
    ) {
      throw new ConflictException(
        'Newsletter has already been sent.',
      );
    }

    // Cancel any scheduler jobs if manual override is triggered
    await this.schedulerService.cancelJob(id);

    if (dto.subject) {
      await this.prisma.communication.update({
        where: {
          id,
        },
        data: {
          subject: dto.subject,
        },
      });
    }

    return this.broadcastService.send(id);
  }

  /**
   * Send broadcast notification.
   */
  async sendNotification(
    id: string,
    dto: SendNotificationDto,
  ) {
    const communication = await this.findOne(id);

    if (
      communication.status ===
      CommunicationStatus.SENT
    ) {
      throw new ConflictException(
        'Communication has already been sent.',
      );
    }

    // Cancel any scheduler jobs if manual override is triggered
    await this.schedulerService.cancelJob(id);

    return this.broadcastService.send(id);
  }

  /**
   * Schedule communication.
   */
  async schedule(
    id: string,
  ) {
    const communication =
      await this.findOne(id);

    if (
      communication.status ===
      CommunicationStatus.SENT
    ) {
      throw new ConflictException(
        'Communication has already been sent.',
      );
    }

    if (!communication.scheduledAt) {
      throw new ConflictException(
        'scheduledAt is required before scheduling.',
      );
    }

    await this.prisma.communication.update({
      where: {
        id,
      },
      data: {
        status:
          CommunicationStatus.SCHEDULED,
      },
    });

    // 🔥 Register job into memory/cron engine
    await this.schedulerService.scheduleJob(id, communication.scheduledAt);

    this.logger.log(
      `Communication scheduled (${id})`,
    );

    return {
      message:
        'Communication scheduled successfully.',
    };
  }

  /**
   * Cancel scheduled communication.
   */
  async cancel(
    id: string,
  ) {
    const communication =
      await this.findOne(id);

    if (
      communication.status !==
      CommunicationStatus.SCHEDULED
    ) {
      throw new ConflictException(
        'Communication is not scheduled.',
      );
    }

    await this.prisma.communication.update({
      where: {
        id,
      },
      data: {
        status:
          CommunicationStatus.DRAFT,
      },
    });

    // 🔥 Kill active cron/timeout hooks cleanly
    await this.schedulerService.cancelJob(id);

    this.logger.log(
      `Scheduled communication cancelled (${id})`,
    );

    return {
      message:
        'Scheduled communication cancelled.',
    };
  }

  /**
   * Communication statistics.
   */
  async statistics(
    id: string,
  ) {
    await this.findOne(id);

    return this.statisticsService.getCommunicationStatistics(
      id,
    );
  }
}