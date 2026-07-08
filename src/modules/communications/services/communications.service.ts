import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../../prisma/prisma.service';

import { CreateBroadcastDto } from '../dto/create-broadcast.dto';
import { UpdateBroadcastDto } from '../dto/update-broadcast.dto';
import { SendNewsletterDto } from '../dto/send-newsletter.dto';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { CommunicationQueryDto } from '../dto/communication-query.dto';

import { BroadcastService } from './broadcast.service';
import { RecipientService } from './recipient.service';
import { StatisticsService } from './statistics.service';
import { SchedulerService } from './scheduler.service';

import { CommunicationStatus } from '../enums/communication-status.enum';

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

    const communication =
      await this.prisma.communication.create({
        data: {
          title: dto.title,

          subject: dto.subject,

          content: dto.content,

          type: dto.type,

          status:
            CommunicationStatus.DRAFT,

          scheduledAt:
            dto.scheduledAt,

          createdById:
            dto.createdById,

          channels:
            dto.channels,
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

    const where: Prisma.CommunicationWhereInput =
      {
        deletedAt: null,
      };

    if (query.status) {
      where.status =
        query.status;
    }

    if (query.type) {
      where.type =
        query.type;
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
    await this.findOne(id);

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

          channels: dto.channels,

          scheduledAt: dto.scheduledAt,
        },

        include: {
          recipients: true,
          logs: true,
        },
      });

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

    await this.prisma.communication.update({
      where: {
        id,
      },

      data: {
        deletedAt: new Date(),
      },
    });

    this.logger.log(
      `Communication deleted (${id})`,
    );

    return;
  }

  /**
   * Restore deleted communication.
   */
  async restore(
    id: string,
  ) {
    const communication =
      await this.prisma.communication.findUnique({
        where: {
          id,
        },
      });

    if (!communication) {
      throw new NotFoundException(
        'Communication not found.',
      );
    }

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
   * Archive communication.
   */
  async archive(
    id: string,
  ) {
    await this.findOne(id);

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

          channels:
            communication.channels,

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
      channels: communication.channels,
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

    if (dto.channels?.length) {
      await this.prisma.communication.update({
        where: {
          id,
        },
        data: {
          channels: dto.channels,
        },
      });
    }

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