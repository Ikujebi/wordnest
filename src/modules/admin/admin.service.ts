import { Injectable, NotFoundException, ForbiddenException, ConflictException, InternalServerErrorException, Logger,BadRequestException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationService } from '../notifications/notification.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { AuthEmailService } from '../../auth/services/auth-email.service';
import { AuthUserService } from '../../auth/services/auth-user.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationService,
    private readonly authEmailService: AuthEmailService,   // new
  private readonly authUserService: AuthUserService, 
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
      ...(query.role ? { user: { role: query.role } } : {}),
      ...(query.status === 'ACTIVE' ? { user: { isActive: true } } : {}),
      ...(query.status === 'SUSPENDED' ? { user: { isActive: false } } : {}),
      ...(query.status === 'PENDING' ? { userId: null } : {}),
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
  /**
   * Total active members and month-over-month growth rate, computed from
   * real Member.createdAt timestamps — no fabricated targets or percentages.
   */
  async getMemberGrowth() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalMembers, joinedThisMonth, joinedLastMonth] = await Promise.all([
      this.prisma.member.count({ where: { deletedAt: null } }),
      this.prisma.member.count({
        where: { deletedAt: null, createdAt: { gte: startOfThisMonth } },
      }),
      this.prisma.member.count({
        where: { deletedAt: null, createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
      }),
    ]);

    const growthRatePercent =
      joinedLastMonth > 0
        ? Number((((joinedThisMonth - joinedLastMonth) / joinedLastMonth) * 100).toFixed(1))
        : joinedThisMonth > 0
        ? 100
        : 0;

    return {
      totalMembers,
      joinedThisMonth,
      joinedLastMonth,
      growthRatePercent,
    };
  }
    /**
   * Most recently added members, for dashboard widgets — separate from
   * listAllMembers, which intentionally sorts alphabetically for the
   * member directory and shouldn't have its default ordering changed.
   */
  async getRecentMembers(limit = 5) {
  return this.prisma.member.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isWorker: true,
      dateOfBirth: true, // <--- Add this line
      createdAt: true,
    },
  });
}
  async listPendingMemberApprovals() {
  return this.prisma.user.findMany({
    where: { role: 'MEMBER', approvalStatus: 'PENDING', deletedAt: null },
    select: { id: true, fullName: true, email: true, createdAt: true, emailVerified: true },
    orderBy: { createdAt: 'asc' },
  });
}

async approveMemberAccount(performingAdminId: string, userId: string) {
  const target = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) throw new NotFoundException('User not found.');
  if (target.role !== 'MEMBER') throw new ForbiddenException('Admins can only approve member accounts.');
  if (target.approvalStatus !== 'PENDING') throw new ConflictException('This account is not pending approval.');

  const updated = await this.prisma.user.update({
    where: { id: userId },
    data: { approvalStatus: 'APPROVED', approvedById: performingAdminId, approvedAt: new Date() },
    select: { id: true, fullName: true, email: true },
  });

  await this.auditLogService.createLog(
    { id: performingAdminId },
    { action: AuditAction.UPDATE_USER, entity: 'USER', entityId: userId, description: `Approved member account for ${target.email}` },
  );

  await this.notificationsService.notify(userId, { title: 'Account Approved', message: 'Your account has been approved. You can now log in.' });
  return updated;
}

async rejectMemberAccount(performingAdminId: string, userId: string) {
  const target = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) throw new NotFoundException('User not found.');
  if (target.role !== 'MEMBER') throw new ForbiddenException('Admins can only reject member accounts.');
  if (target.approvalStatus !== 'PENDING') throw new ConflictException('This account is not pending approval.');

  const updated = await this.prisma.user.update({
    where: { id: userId },
    data: { approvalStatus: 'REJECTED', approvedById: performingAdminId, approvedAt: new Date() },
    select: { id: true, fullName: true, email: true },
  });

  await this.auditLogService.createLog(
    { id: performingAdminId },
    { action: AuditAction.UPDATE_USER, entity: 'USER', entityId: userId, description: `Rejected member account for ${target.email}` },
  );
  return updated;
}
async resendPendingMemberVerification(performingAdminId: string, userId: string) {
  const target = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { member: { select: { id: true } } },
  });
  if (!target || target.deletedAt) throw new NotFoundException('User not found.');
  if (target.role !== 'MEMBER') throw new ForbiddenException('Admins can only manage member accounts.');
  if (target.emailVerified) throw new ConflictException('This account is already verified.');

  const authenticatedUser = await this.authUserService.mapAuthenticatedUser(target);
  await this.authEmailService.sendVerificationEmail(authenticatedUser);

  await this.auditLogService.createLog(
    { id: performingAdminId },
    { action: AuditAction.UPDATE_USER, entity: 'USER', entityId: userId, description: `Resent verification email to ${target.email}` },
  );

  return { message: `Verification email resent to ${target.email}.` };
}

async hardDeletePendingMember(performingAdminId: string, userId: string) {
  const target = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) throw new NotFoundException('User not found.');
  if (target.role !== 'MEMBER') throw new ForbiddenException('Admins can only manage member accounts.');
  if (target.approvalStatus !== 'PENDING') {
    throw new BadRequestException('Only accounts still pending approval can be permanently deleted this way.');
  }

  await this.prisma.user.delete({ where: { id: userId } });

  await this.auditLogService.createLog(
    { id: performingAdminId },
    {
      action: AuditAction.DELETE_USER,
      entity: 'USER',
      entityId: userId,
      description: `Permanently deleted pending member account for ${target.email}`,
      oldValues: { email: target.email, role: target.role },
    },
  );

  return { message: 'Pending account permanently deleted.' };
}
/**
 * Fetches members with upcoming birthdays.
 */
async getUpcomingBirthdays(limit = 5) {
  const members = await this.prisma.member.findMany({
    where: {
      deletedAt: null,
      dateOfBirth: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isWorker: true,
      dateOfBirth: true,
      createdAt: true,
    },
  });

  const today = new Date();

  // Filter out any potential nulls and type-cast for safe Date manipulation
  const validMembers = members.filter(
    (m): m is typeof m & { dateOfBirth: Date } => m.dateOfBirth !== null,
  );

  // Sort by next upcoming birthday anniversary
  const sorted = validMembers.sort((a, b) => {
    const dobA = new Date(a.dateOfBirth);
    const dobB = new Date(b.dateOfBirth);

    const nextA = new Date(today.getFullYear(), dobA.getUTCMonth(), dobA.getUTCDate());
    const nextB = new Date(today.getFullYear(), dobB.getUTCMonth(), dobB.getUTCDate());

    if (nextA < today) nextA.setFullYear(today.getFullYear() + 1);
    if (nextB < today) nextB.setFullYear(today.getFullYear() + 1);

    return nextA.getTime() - nextB.getTime();
  });

  return sorted.slice(0, limit);
}
}