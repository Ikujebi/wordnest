import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { NotificationType, Role, PrayerRequestStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePrayerRequestDto } from './dto/create-prayer-request.dto';
import { UpdatePrayerRequestDto } from './dto/update-prayer-request.dto';
import { AssignPrayerRequestDto } from './dto/assign-prayer-request.dto';
import { PrayerRequestNoteDto } from './dto/prayer-request-note.dto';
import { PrayerCommunicationService } from './prayer-communication.service';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';

@Injectable()
export class PrayerRequestsService {
  private readonly logger = new Logger(PrayerRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prayerCommunicationService: PrayerCommunicationService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Get all eligible users who can be assigned to a prayer request:
   * 1. SUPER_ADMINs
   * 2. ADMINs
   * 3. Workers linked to the Prayer Department
   */
  async getEligibleAssignees() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { role: Role.SUPER_ADMIN },
          { role: Role.ADMIN },
          {
            member: {
              worker: {
                isActive: true,
                deletedAt: null,
                department: {
                  slug: {
                    in: ['prayer', 'intercessory-prayer', 'prayer-department'],
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        member: {
          select: {
            worker: {
              select: {
                position: true,
                department: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });
  }

  /**
   * Create prayer request from public website
   */
  async create(dto: CreatePrayerRequestDto) {
    const prayerRequest = await this.prisma.prayerRequest.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        subject: dto.subject,
        message: dto.message,
        category: dto.category,
        priority: dto.priority,
        visibility: dto.visibility,
        isConfidential: dto.isConfidential ?? true,
        allowFollowUp: dto.allowFollowUp ?? true,
        preferredContactMethod: dto.preferredContactMethod,
        status: PrayerRequestStatus.PENDING,
      },
    });

    await this.prayerCommunicationService.sendRequestReceivedEmail(
      prayerRequest,
    );

    // Notify admins
    await this.notificationService.notifyAdmins({
      title: 'New Prayer Request',
      message: `${prayerRequest.firstName} ${prayerRequest.lastName} submitted a prayer request.`,
      type: NotificationType.PRAYER,
    });

    // Audit
    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.CREATE_PRAYER_REQUEST,
        entity: 'PrayerRequest',
        entityId: prayerRequest.id,
        description: 'Prayer request submitted',
        newValues: prayerRequest,
      },
    );

    this.logger.log(`Prayer request created ${prayerRequest.id}`);

    return prayerRequest;
  }

  /**
   * Admin dashboard list
   */
  async findAll() {
    return this.prisma.prayerRequest.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        assignedTo: true,
        notes: true,
      },
    });
  }

  /**
   * Single prayer request
   */
  async findOne(id: string) {
    const prayer = await this.prisma.prayerRequest.findUnique({
      where: { id },
      include: {
        assignedTo: true,
        notes: true,
      },
    });

    if (!prayer) {
      throw new NotFoundException('Prayer request not found');
    }

    return prayer;
  }

  /**
   * Update prayer request
   */
  async update(id: string, dto: UpdatePrayerRequestDto) {
    const oldPrayer = await this.findOne(id);

    const updated = await this.prisma.prayerRequest.update({
      where: { id },
      data: dto,
    });

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.UPDATE_PRAYER_REQUEST,
        entity: 'PrayerRequest',
        entityId: updated.id,
        description: 'Prayer request updated',
        oldValues: oldPrayer,
        newValues: updated,
      },
    );

    return updated;
  }

  /**
   * Assign prayer request with strict role & department validation
   */
  async assignPrayer(id: string, dto: AssignPrayerRequestDto) {
    const prayer = await this.findOne(id);

    // Validate that the assigned target is a SUPER_ADMIN, ADMIN, or Prayer Dept Worker
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: dto.assignedToId,
        isActive: true,
        deletedAt: null,
        OR: [
          { role: Role.SUPER_ADMIN },
          { role: Role.ADMIN },
          {
            member: {
              worker: {
                isActive: true,
                deletedAt: null,
                department: {
                  slug: {
                    in: ['prayer', 'intercessory-prayer', 'prayer-department'],
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        ],
      },
    });

    if (!assignee) {
      throw new BadRequestException(
        'Selected user is not authorized to receive prayer assignments. User must be a Super Admin, Admin, or an active worker in the Prayer Department.',
      );
    }

    const updated = await this.prisma.prayerRequest.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId,
        status: PrayerRequestStatus.ASSIGNED,
      },
      include: {
        assignedTo: true,
      },
    });

    if (prayer.email) {
      await this.prayerCommunicationService.sendAssignedEmail(
        updated,
        dto.note ?? '',
      );
    }

    // Notify assigned user directly using notify (takes userId)
    await this.notificationService.notify(dto.assignedToId, {
      title: 'Prayer Assignment',
      message: `${prayer.subject} has been assigned to you.`,
      type: NotificationType.PRAYER,
    });

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.ASSIGN_PRAYER_REQUEST,
        entity: 'PrayerRequest',
        entityId: updated.id,
        description: `Prayer request assigned to ${dto.assignedToId}`,
        oldValues: prayer,
        newValues: updated,
      },
    );

    return updated;
  }

  /**
   * Mark prayer as answered
   */
  async markAnswered(id: string, testimony?: string) {
    await this.findOne(id);

    const updated = await this.prisma.prayerRequest.update({
      where: { id },
      data: {
        status: PrayerRequestStatus.ANSWERED,
        testimony,
        answeredAt: new Date(),
      },
    });

    await this.prayerCommunicationService.sendAnsweredEmail(updated);

    if (updated.requesterId) {
      await this.notificationService.create({
        userId: updated.requesterId,
        title: 'Prayer Answered',
        message: 'Your prayer request has been marked as answered.',
        type: NotificationType.PRAYER,
      });
    }

    await this.notificationService.notifyAdmins({
      title: 'Prayer Answered',
      message: `${updated.subject} has been marked as answered.`,
      type: NotificationType.PRAYER,
    });

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.ANSWER_PRAYER_REQUEST,
        entity: 'PrayerRequest',
        entityId: updated.id,
        description: 'Prayer request marked answered',
        newValues: updated,
      },
    );

    return updated;
  }

  /**
   * Add note from prayer team
   */
  async addNote(
    id: string,
    dto: PrayerRequestNoteDto,
    authorId?: string,
    senderName?: string,
  ) {
    const prayer = await this.findOne(id);

    // 1. Persist note in database matching PrayerRequestNote model
    const note = await this.prisma.prayerRequestNote.create({
      data: {
        prayerRequestId: prayer.id,
        note: dto.note,
        authorId: authorId,
        isInternal: dto.isInternal ?? true,
      },
    });

    if (prayer.assignedToId) {
      await this.notificationService.create({
        userId: prayer.assignedToId,
        title: 'Prayer Note Added',
        message: `A new note has been added to "${prayer.subject}".`,
        type: NotificationType.PRAYER,
      });
    }

    await this.auditLogService.createLog(
      { id: authorId },
      {
        action: AuditAction.ADD_PRAYER_NOTE,
        entity: 'PrayerRequest',
        entityId: prayer.id,
        description: 'Prayer team note added',
        newValues: note,
      },
    );

    // 2. Optionally send email to the requester if requested
    if (dto.sendToRequester && prayer.email) {
      const emailContent = dto.requesterMessage || dto.note;

      await this.prayerCommunicationService.sendPrayerTeamNoteEmail(
        prayer,
        emailContent,
        senderName,
      );
    }

    return note;
  }

  /**
   * Delete/archive prayer
   */
  async remove(id: string) {
    const prayer = await this.findOne(id);

    const archived = await this.prisma.prayerRequest.update({
      where: { id },
      data: {
        status: PrayerRequestStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.notificationService.notifyAdmins({
      title: 'Prayer Archived',
      message: `${prayer.subject} has been archived.`,
      type: NotificationType.PRAYER,
    });

    await this.auditLogService.createLog(
      {},
      {
        action: AuditAction.ARCHIVE_PRAYER_REQUEST,
        entity: 'PrayerRequest',
        entityId: archived.id,
        description: 'Prayer request archived',
        oldValues: prayer,
        newValues: archived,
      },
    );

    return archived;
  }
}