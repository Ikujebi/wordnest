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
  ) { }

  /**
   * Helper to format actor context for audit logs without triggering TS errors
   */
  private getActorContext(actorId?: string) {
    return actorId ? { id: actorId } : {};
  }

  /**
    * Eligible assignees: SUPER_ADMIN (always) or any active DepartmentMember
    * of the Prayer department (LEADER or MEMBER). ADMIN role alone is no
    * longer sufficient — matches PrayerAccessGuard exactly.
    */
  async getEligibleAssignees() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { role: Role.SUPER_ADMIN },
          {
            member: {
              departments: {
                some: {
                  status: 'ACTIVE',
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
            departments: {
              where: {
                status: 'ACTIVE',
                deletedAt: null,
                department: {
                  slug: { in: ['prayer', 'intercessory-prayer', 'prayer-department'], mode: 'insensitive' },
                },
              },
              select: {
                role: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  /**
   * Create prayer request from public website
   */
  /**
   * Create prayer request from public website
   */
  async create(dto: CreatePrayerRequestDto, actorId?: string) {
    let memberId: string | undefined;
    let requesterId: string | undefined;

    if (!dto.anonymous) {
      if (actorId) {
        // Logged-in submitter, not requesting anonymity — link via their
        // account directly rather than guessing from email.
        const member = await this.prisma.member.findUnique({
          where: { userId: actorId },
          select: { id: true },
        });
        memberId = member?.id;
        requesterId = actorId;
      } else if (dto.email) {
        // Anonymous public visitor who happened to type an email matching
        // an existing member — soft-link for continuity, same as before.
        const existingMember = await this.prisma.member.findFirst({
          where: { email: { equals: dto.email, mode: 'insensitive' }, deletedAt: null },
          select: { id: true, userId: true },
        });
        if (existingMember) {
          memberId = existingMember.id;
          requesterId = existingMember.userId ?? undefined;
        }
      }
    }
    // dto.anonymous === true: memberId/requesterId both stay undefined,
    // regardless of login state or email match. This is the actual privacy
    // guarantee — not just omitting requesterId, since matching by email
    // alone is just as identifying to prayer team staff.

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
        memberId,
        requesterId,
      },
    });

    await this.prayerCommunicationService.sendRequestReceivedEmail(prayerRequest);

    await this.notificationService.notifyAdmins({
      title: 'New Prayer Request',
      message: `${prayerRequest.firstName ?? 'Someone'} ${prayerRequest.lastName ?? ''} submitted a prayer request.`.trim(),
      type: NotificationType.PRAYER,
    });

    await this.auditLogService.createLog(
      this.getActorContext(actorId),
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
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
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
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
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
  async update(id: string, dto: UpdatePrayerRequestDto, actorId?: string) {
    const oldPrayer = await this.findOne(id);

    const updated = await this.prisma.prayerRequest.update({
      where: { id },
      data: dto,
    });

    await this.auditLogService.createLog(
      this.getActorContext(actorId),
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
  async assignPrayer(id: string, dto: AssignPrayerRequestDto, actorId?: string) {
    const prayer = await this.findOne(id);

    // Same DepartmentMember-based check as getEligibleAssignees — keeps the
    // "who shows in the dropdown" and "who's actually allowed" definitions
    // from drifting apart.
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: dto.assignedToId,
        isActive: true,
        deletedAt: null,
        OR: [
          { role: Role.SUPER_ADMIN },
          {
            member: {
              departments: {
                some: {
                  status: 'ACTIVE',
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
          },
        ],
      },
    });

    if (!assignee) {
      throw new BadRequestException(
        'Selected user is not authorized to receive prayer assignments. User must be a Super Admin or an active member of the Prayer Department.',
      );
    }

    const updated = await this.prisma.prayerRequest.update({
      where: { id },
      data: { assignedToId: dto.assignedToId, status: PrayerRequestStatus.ASSIGNED },
      include: { assignedTo: true },
    });

    if (prayer.email) {
      const assigneeName = assignee.fullName || 'Prayer Team Member';
      await this.prayerCommunicationService.sendAssignedEmail(updated, assigneeName);
    }

    await this.notificationService.notify(dto.assignedToId, {
      title: 'Prayer Assignment',
      message: `Prayer request "${prayer.subject}" has been assigned to you.`,
      type: NotificationType.PRAYER,
    });

    await this.auditLogService.createLog(
      this.getActorContext(actorId),
      {
        action: AuditAction.ASSIGN_PRAYER_REQUEST,
        entity: 'PrayerRequest',
        entityId: updated.id,
        description: `Prayer request assigned to user ID ${dto.assignedToId}`,
        oldValues: prayer,
        newValues: updated,
      },
    );

    return updated;
  }

  /**
   * Mark prayer as answered
   */
  async markAnswered(id: string, testimony?: string, actorId?: string) {
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
      message: `Prayer request "${updated.subject}" has been marked as answered.`,
      type: NotificationType.PRAYER,
    });

    await this.auditLogService.createLog(
      this.getActorContext(actorId),
      {
        action: AuditAction.ANSWER_PRAYER_REQUEST,
        entity: 'PrayerRequest',
        entityId: updated.id,
        description: 'Prayer request marked as answered',
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
      this.getActorContext(authorId),
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
  async remove(id: string, actorId?: string) {
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
      message: `Prayer request "${prayer.subject}" has been archived.`,
      type: NotificationType.PRAYER,
    });

    await this.auditLogService.createLog(
      this.getActorContext(actorId),
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
  /**
   * Prayer requests assigned to the currently authenticated user — for
   * regular Prayer Department workers who can work assignments but don't
   * get the full management view.
   */
  async findMyAssigned(userId: string) {
    return this.prisma.prayerRequest.findMany({
      where: { assignedToId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
      },
    });
  }
  /**
   * A logged-in user's own submitted prayer requests — distinct from
   * findMyAssigned (requests assigned TO them as a prayer-team worker).
   * Requests they submitted anonymously are deliberately excluded, since
   * there's nothing on the record linking it back to them to query by.
   */
  async findMyRequests(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      select: { id: true },
    });

    return this.prisma.prayerRequest.findMany({
      where: {
        deletedAt: null,
        OR: [
          { requesterId: userId },
          ...(member ? [{ memberId: member.id }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        notes: { where: { isInternal: false }, orderBy: { createdAt: 'desc' } },
      },
    });
  }
  
  /**
   * Authorization check for single-item access: full managers (checked via
   * PrayerAccessGuard upstream for list/assign routes) always pass; for
   * detail/status/notes routes we additionally allow the assignee themself.
   */
  async assertCanAccess(prayerId: string, userId: string, role: string) {
  // 1. Super Admins bypass all access checks
  if (role === 'SUPER_ADMIN') return;

  // 2. Retrieve prayer request with assigned & requester ownership IDs
  const prayer = await this.prisma.prayerRequest.findUnique({
    where: { id: prayerId },
    select: { assignedToId: true, requesterId: true },
  });

  if (!prayer) {
    throw new NotFoundException('Prayer request not found');
  }

  // 3. Direct Access Rules (Assigned Intercessor OR Requester Self-Access)
  if (prayer.assignedToId === userId) return;
  if (prayer.requesterId === userId) return;

  // 4. Department Member Access Check
  const member = await this.prisma.member.findUnique({
    where: { userId },
    select: { id: true },
  });

  const isDeptMember = member
    ? await this.prisma.departmentMember.findFirst({
        where: {
          memberId: member.id,
          // Any active Prayer dept member, not just LEADER.
          status: 'ACTIVE',
          deletedAt: null,
          department: {
            slug: {
              in: ['prayer', 'intercessory-prayer', 'prayer-department'],
              mode: 'insensitive',
            },
          },
        },
      })
    : null;

  if (!isDeptMember) {
    throw new BadRequestException('You do not have access to this prayer request.');
  }
}

  /**
   * Dedicated status transition (matches the frontend's updatePrayerStatus).
   * Distinct from `update()` since it's a narrower, safer surface — only the
   * status field, not arbitrary field overwrites.
   */
  async updateStatus(id: string, status: PrayerRequestStatus, actorId?: string) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.prayerRequest.update({
      where: { id },
      data: {
        status,
        ...(status === PrayerRequestStatus.CLOSED ? { closedAt: new Date() } : {}),
        ...(status === PrayerRequestStatus.PRAYING ? { acknowledgedAt: new Date() } : {}),
      },
    });

    await this.auditLogService.createLog(
      this.getActorContext(actorId),
      {
        action: AuditAction.UPDATE_PRAYER_REQUEST,
        entity: 'PrayerRequest',
        entityId: updated.id,
        description: `Prayer request status changed to ${status}`,
        oldValues: { status: existing.status },
        newValues: { status: updated.status },
      },
    );

    return updated;
  }

}