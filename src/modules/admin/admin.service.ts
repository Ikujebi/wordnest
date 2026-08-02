import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationService } from '../notifications/notification.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { MemberQueryDto } from './dto/member-query.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationService,
  ) {}

  async getDashboardStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalEvents, activeDepartments, totalMembers, activeWorkers] = await Promise.all([
      this.prisma.event.count({
        where: { startDate: { gte: startOfToday }, deletedAt: null },
      }),
      this.prisma.department.count({ where: { deletedAt: null } }),
      this.prisma.member.count({ where: { deletedAt: null } }),
      this.prisma.worker.count({ where: { deletedAt: null, isActive: true } }),
    ]);

    return { totalEvents, activeDepartments, totalMembers, activeWorkers };
  }

  /**
   * Paginated, searchable member listing.
   */
  async listAllMembers(query: MemberQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phoneNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastName: 'asc' },
        include: {
          user: { select: { id: true, email: true, isActive: true, role: true } },
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async targetIndividualMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phoneNumber: true, role: true, isActive: true },
        },
      },
    });

    if (!member || member.deletedAt) {
      throw new NotFoundException(`Member with ID ${memberId} does not exist or has been removed.`);
    }

    return member;
  }

  /**
   * Creates a bare member profile (not tied to a User login — that's a separate
   * invite/signup flow). Useful for admins registering walk-in congregants.
   */
  async createMember(dto: CreateMemberDto, adminId: string) {
    try {
      const member = await this.prisma.member.create({
        data: { ...dto, createdById: adminId },
      });

      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.CREATE_MEMBER,
          entity: 'MEMBER',
          entityId: member.id,
          description: `Created member profile for ${member.firstName} ${member.lastName}`,
          newValues: member,
        },
      );

      return member;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A member with this email already exists.');
      }
      this.logger.error('Failed to create member', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Could not create member profile.');
    }
  }

  async updateIndividualMemberStatus(
    performingAdminId: string,
    memberId: string,
    data: UpdateMemberStatusDto,
  ) {
    const memberExists = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!memberExists || memberExists.deletedAt) {
      throw new NotFoundException('Target member not found.');
    }

    const updatedMember = await this.prisma.member.update({
      where: { id: memberId },
      data: {
        ...(data.isWorker !== undefined && { isWorker: data.isWorker }),
        ...(data.isActive !== undefined || data.role !== undefined
          ? {
              user: {
                update: {
                  ...(data.isActive !== undefined && { isActive: data.isActive }),
                  ...(data.role !== undefined && { role: data.role }),
                },
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true, isActive: true } },
      },
    });

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.UPDATE_MEMBER,
        entity: 'MEMBER',
        entityId: memberId,
        description: `Updated member details for ${memberId}`,
        oldValues: {
          isWorker: memberExists.isWorker,
          isActive: memberExists.user?.isActive,
          role: memberExists.user?.role,
        },
        newValues: data,
      },
    );

    if (memberExists.userId) {
      await this.notificationsService.notify(memberExists.userId, {
        title: 'Member Profile Updated',
        message: 'Your member profile details were updated by an administrator.',
      });
    }

    return updatedMember;
  }

  /**
   * Soft-deletes a member profile.
   */
  async deleteMember(memberId: string, adminId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });

    if (!member || member.deletedAt) {
      throw new NotFoundException('Member not found.');
    }

    const deleted = await this.prisma.member.update({
      where: { id: memberId },
      data: { deletedAt: new Date() },
    });

    await this.auditLogService.createLog(
      { id: adminId },
      {
        action: AuditAction.DELETE_MEMBER,
        entity: 'MEMBER',
        entityId: memberId,
        description: `Deleted member profile for ${member.firstName} ${member.lastName}`,
        oldValues: member,
        newValues: deleted,
      },
    );

    return { message: 'Member removed successfully.' };
  }
}