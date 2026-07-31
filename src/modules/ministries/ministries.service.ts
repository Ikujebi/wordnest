import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  Ministry,
  MinistryMember,
  WorkerAttendance,
  Prisma,
  NotificationType,
} from '@prisma/client';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { AssignMinistryLeaderDto } from './dto/assign-ministry-leader.dto';
import { AddMinistryMemberDto } from './dto/add-ministry-member.dto';
import { UpdateMinistryMemberDto } from './dto/update-ministry-member.dto';
import { LogWorkerAttendanceDto } from './dto/log-worker-attendance.dto';
import { NotificationService } from '../notifications/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import slugify from 'slugify';

@Injectable()
export class MinistriesService {
  private readonly logger = new Logger(MinistriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a new ministry (e.g. Youth, Men's, Women's Fellowship).
   */
  async create(dto: CreateMinistryDto, creatorId: string): Promise<Ministry> {
    const slug = slugify(dto.name, { lower: true, strict: true });

    try {
      const ministry = await this.prisma.ministry.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description ?? null,
          leaderId: dto.leaderId ?? null,
          createdById: creatorId,
        },
      });

      await this.auditLogService.createLog(
        { id: creatorId },
        {
          action: AuditAction.CREATE_MINISTRY,
          entity: 'Ministry',
          entityId: ministry.id,
          description: `Ministry "${ministry.name}" was created.`,
          newValues: ministry,
        },
      );

      await this.notificationService.notifySuperAdmins({
        title: 'New Ministry Created',
        message: `Ministry "${ministry.name}" has been created.`,
        type: NotificationType.SYSTEM,
      });

      if (dto.leaderId) {
        await this.notificationService.notifyMember(dto.leaderId, {
          title: 'Ministry Leadership Assignment',
          message: `You have been designated as the leader of ${ministry.name}.`,
          type: NotificationType.SYSTEM,
        });
      }

      return ministry;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A ministry with this name already exists.');
      }
      this.logger.error('Failed to create ministry', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not create ministry.');
    }
  }

  /**
   * Lists all active ministries.
   */
  async findAll(): Promise<Ministry[]> {
    return this.prisma.ministry.findMany({
      where: { deletedAt: null },
      include: {
        leader: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Retrieves a single ministry by ID.
   */
  async findOne(id: string): Promise<Ministry> {
    const ministry = await this.prisma.ministry.findUnique({
      where: { id, deletedAt: null },
      include: {
        leader: true,
        _count: { select: { members: true } },
      },
    });

    if (!ministry) {
      throw new NotFoundException('Ministry not found.');
    }

    return ministry;
  }

  /**
   * Updates ministry name/description.
   */
  async update(id: string, dto: UpdateMinistryDto, updaterId: string): Promise<Ministry> {
    const existing = await this.findOne(id);

    try {
      const updated = await this.prisma.ministry.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          updatedById: updaterId,
        },
      });

      await this.auditLogService.createLog(
        { id: updaterId },
        {
          action: AuditAction.UPDATE_MINISTRY,
          entity: 'Ministry',
          entityId: id,
          description: `Ministry "${existing.name}" was updated.`,
          oldValues: existing,
          newValues: updated,
        },
      );

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A ministry with this name already exists.');
      }
      this.logger.error(`Failed to update ministry ${id}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not update ministry.');
    }
  }

  /**
   * Soft-deletes a ministry.
   */
  async remove(id: string, updaterId: string) {
    const existing = await this.findOne(id);

    const deleted = await this.prisma.ministry.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: updaterId },
    });

    await this.auditLogService.createLog(
      { id: updaterId },
      {
        action: AuditAction.DELETE_MINISTRY,
        entity: 'Ministry',
        entityId: id,
        description: `Ministry "${existing.name}" was deleted.`,
        oldValues: existing,
        newValues: deleted,
      },
    );

    return { message: 'Ministry deleted successfully.' };
  }

  /**
   * Assigns (or changes) the single designated overall leader of a ministry.
   * The candidate must already be an active roster member (added via addMember first).
   */
  async assignLeader(
    ministryId: string,
    dto: AssignMinistryLeaderDto,
    updaterId: string,
  ): Promise<Ministry> {
    const { leaderId } = dto;

    const ministry = await this.prisma.ministry.findUnique({
      where: { id: ministryId, deletedAt: null },
    });

    if (!ministry) {
      throw new NotFoundException('Ministry not found.');
    }

    const candidate = await this.prisma.ministryMember.findUnique({
      where: { memberId_ministryId: { memberId: leaderId, ministryId } },
      include: { member: true },
    });

    if (!candidate || candidate.deletedAt || candidate.status !== 'ACTIVE') {
      throw new BadRequestException(
        'The designated leader must be an active member of this ministry roster.',
      );
    }

    const updated = await this.prisma.ministry.update({
      where: { id: ministryId },
      data: { leaderId, updatedById: updaterId },
      include: { leader: true },
    });

    await this.auditLogService.createLog(
      { id: updaterId },
      {
        action: AuditAction.UPDATE_MINISTRY,
        entity: 'Ministry',
        entityId: ministryId,
        description: `Assigned ${candidate.member.firstName} ${candidate.member.lastName} as leader of ministry "${ministry.name}".`,
        oldValues: { leaderId: ministry.leaderId },
        newValues: { leaderId },
      },
    );

    await this.notificationService.notifyMember(leaderId, {
      title: 'Ministry Leadership Assignment',
      message: `You have been assigned as the leader of ${ministry.name}.`,
      type: NotificationType.SYSTEM,
    });

    return updated;
  }

  /**
   * Removes the designated overall leader without removing them from the roster.
   */
  async removeLeader(ministryId: string, updaterId: string): Promise<Ministry> {
    const ministry = await this.findOne(ministryId);

    const updated = await this.prisma.ministry.update({
      where: { id: ministryId },
      data: { leaderId: null, updatedById: updaterId },
    });

    await this.auditLogService.createLog(
      { id: updaterId },
      {
        action: AuditAction.UPDATE_MINISTRY,
        entity: 'Ministry',
        entityId: ministryId,
        description: `Removed the designated leader from ministry "${ministry.name}".`,
        oldValues: { leaderId: ministry.leaderId },
        newValues: { leaderId: null },
      },
    );

    return updated;
  }

  /**
   * Adds a member to a ministry roster with a super-admin-defined role title.
   */
  async addMember(
    ministryId: string,
    dto: AddMinistryMemberDto,
    creatorId: string,
  ): Promise<MinistryMember> {
    const ministry = await this.prisma.ministry.findUnique({
      where: { id: ministryId, deletedAt: null },
    });

    if (!ministry) {
      throw new NotFoundException('Ministry not found.');
    }

    try {
      const roster = await this.prisma.ministryMember.create({
        data: {
          ministryId,
          memberId: dto.memberId,
          roleTitle: dto.roleTitle?.trim() || 'Member',
          isLeader: dto.isLeader ?? false,
          createdById: creatorId,
        },
        include: { member: true },
      });

      await this.auditLogService.createLog(
        { id: creatorId },
        {
          action: AuditAction.ADD_MINISTRY_MEMBER,
          entity: 'MinistryMember',
          entityId: roster.id,
          description: `${roster.member.firstName} ${roster.member.lastName} added to "${ministry.name}" as ${roster.roleTitle}.`,
          newValues: roster,
        },
      );

      await this.notificationService.notifyMember(dto.memberId, {
        title: 'Ministry Assignment',
        message: `You have been added to ${ministry.name} as ${roster.roleTitle}.`,
        type: NotificationType.ANNOUNCEMENT,
      });

      return roster;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This member is already registered in this ministry.');
      }
      this.logger.error(
        `Failed to add member to ministry ${ministryId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Could not add member to ministry roster.');
    }
  }

  /**
   * Updates a roster entry — role title, leader flag, or status (super-admin discretion).
   */
  async updateMemberAssignment(
    ministryId: string,
    memberId: string,
    dto: UpdateMinistryMemberDto,
    updaterId: string,
  ): Promise<MinistryMember> {
    const existing = await this.prisma.ministryMember.findUnique({
      where: { memberId_ministryId: { memberId, ministryId } },
      include: { ministry: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Active roster record not found for this member and ministry.');
    }

    const data: Prisma.MinistryMemberUpdateInput = {
      ...dto,
      updatedById: updaterId,
      ...(dto.status === 'INACTIVE' ? { leftAt: new Date() } : {}),
      ...(dto.status === 'ACTIVE' ? { leftAt: null } : {}),
    };

    const updated = await this.prisma.ministryMember.update({
      where: { memberId_ministryId: { memberId, ministryId } },
      data,
    });

    await this.auditLogService.createLog(
      { id: updaterId },
      {
        action: AuditAction.UPDATE_MINISTRY_MEMBER,
        entity: 'MinistryMember',
        entityId: updated.id,
        description: `Updated roster entry for member ${memberId} in "${existing.ministry.name}".`,
        oldValues: existing,
        newValues: updated,
      },
    );

    return updated;
  }

  /**
   * Lists active roster members of a ministry (leaders and general members alike).
   */
  async getMembers(ministryId: string) {
    const ministry = await this.prisma.ministry.findUnique({
      where: { id: ministryId, deletedAt: null },
    });

    if (!ministry) {
      throw new NotFoundException('Ministry not found.');
    }

    return this.prisma.ministryMember.findMany({
      where: { ministryId, deletedAt: null, status: 'ACTIVE' },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ isLeader: 'desc' }, { member: { lastName: 'asc' } }],
    });
  }

  /**
   * Tracks or updates a worker's roster duty compliance log atomically via a structural upsert.
   */
  async trackWorkerDuty(dto: LogWorkerAttendanceDto): Promise<WorkerAttendance> {
    const targetDate = new Date(dto.date);
    targetDate.setUTCHours(0, 0, 0, 0);

    try {
      return await this.prisma.workerAttendance.upsert({
        where: { workerId_date: { workerId: dto.workerId, date: targetDate } },
        update: { status: dto.status },
        create: { workerId: dto.workerId, date: targetDate, status: dto.status },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException('The designated Worker identity reference does not exist inside the active roster pool.');
      }
      this.logger.error(`Duty log operational crash recorded for worker: ${dto.workerId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to process worker service attendance entry.');
    }
  }
}