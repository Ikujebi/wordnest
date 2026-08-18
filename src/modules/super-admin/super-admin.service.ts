import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Role, Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationService } from '../notifications/notification.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { UpdateIndividualStatusDto } from './dto/update-individual-status.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { AuthEmailService } from '../../auth/services/auth-email.service';
import { AuthUserService } from '../../auth/services/auth-user.service';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly authEmailService: AuthEmailService,
    private readonly authUserService: AuthUserService,
  ) {}

  // ==========================================
  //        GLOBAL DASHBOARD METHODS
  // ==========================================

  async getDashboardStats() {
    const now = new Date();

    const startOfCurrentMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const startOfPreviousMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const sixMonthsAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    );

    const [
      totalMembers,
      activeWorkers,
      totalAdmins,
      totalDepartments,
      totalEvents,
      totalSermons,
      unreadMessages,
      pendingPrayerRequests,
      currentMonthlyGiving,
      prevMembersCount,
      prevWorkersCount,
      prevGivingSum,
      prevEventsCount,
      membersChartRaw,
      givingChartRaw,
      attendanceChartRaw,
      auditLogs,
      latestMembers,
      latestPrayerRequests,
      latestMessages,
      latestEvents,
    ] = await Promise.all([
      this.prisma.member.count({ where: { deletedAt: null } }),
      this.prisma.member.count({ where: { isWorker: true, deletedAt: null } }),
      this.prisma.user.count({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
          deletedAt: null,
        },
      }),
      this.prisma.department.count({ where: { deletedAt: null } }),
      this.prisma.event.count({ where: { deletedAt: null } }),
      this.prisma.sermon.count({ where: { deletedAt: null } }),
      this.prisma.contactMessage.count({
        where: { isRead: false, deletedAt: null },
      }),
      this.prisma.prayerRequest.count({
        where: { status: 'PENDING', deletedAt: null },
      }),
      this.prisma.giving.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: startOfCurrentMonth }, deletedAt: null },
      }),
      this.prisma.member.count({
        where: { createdAt: { lt: startOfCurrentMonth }, deletedAt: null },
      }),
      this.prisma.member.count({
        where: {
          isWorker: true,
          createdAt: { lt: startOfCurrentMonth },
          deletedAt: null,
        },
      }),
      this.prisma.giving.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth },
          deletedAt: null,
        },
      }),
      this.prisma.event.count({
        where: { createdAt: { lt: startOfCurrentMonth }, deletedAt: null },
      }),
      this.prisma.member.groupBy({
        by: ['createdAt'],
        _count: { _all: true },
        where: { createdAt: { gte: sixMonthsAgo }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.giving.groupBy({
        by: ['createdAt'],
        _sum: { amount: true },
        where: { createdAt: { gte: sixMonthsAgo }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.event.findMany({
        take: 6,
        where: { startDate: { lte: now }, deletedAt: null },
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          title: true,
          startDate: true,
          _count: { select: { attendances: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
      }),
      this.prisma.member.findMany({
        take: 5,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
        },
      }),
      this.prisma.prayerRequest.findMany({
        take: 5,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          subject: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.contactMessage.findMany({
        take: 5,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          subject: true,
          isRead: true,
          createdAt: true,
        },
      }),
      this.prisma.event.findMany({
        take: 5,
        where: { deletedAt: null },
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          title: true,
          startDate: true,
          location: true,
        },
      }),
    ]);

    const computeGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const currentGivingVal = Number(currentMonthlyGiving._sum.amount ?? 0);
    const prevGivingVal = Number(prevGivingSum._sum.amount ?? 0);

    return {
      overview: {
        totalMembers,
        activeWorkers,
        totalAdmins,
        totalDepartments,
        totalEvents,
        totalSermons,
        monthlyGiving: currentGivingVal,
        unreadMessages,
        pendingPrayerRequests,
      },
      growth: {
        members: computeGrowth(totalMembers, prevMembersCount),
        workers: computeGrowth(activeWorkers, prevWorkersCount),
        giving: computeGrowth(currentGivingVal, prevGivingVal),
        events: computeGrowth(totalEvents, prevEventsCount),
      },
      charts: {
        monthlyMembers: this.groupDataByMonth(membersChartRaw, '_count'),
        monthlyGiving: this.groupDataByMonth(givingChartRaw, '_sum'),
        attendance: attendanceChartRaw.map((e) => ({
          eventId: e.id,
          title: e.title,
          date: e.startDate,
          count: e._count.attendances,
        })),
      },
      recent: {
        auditLogs,
        latestMembers,
        latestPrayerRequests,
        latestMessages,
        latestEvents,
      },
    };
  }

  private groupDataByMonth(
    data: any[],
    countOrSumKey: '_count' | '_sum',
    dateField: string = 'createdAt',
  ) {
    const monthlyMap = new Map<string, number>();

    for (const item of data) {
      const rawDate = item[dateField] || item.createdAt;
      if (!rawDate) continue;

      const monthKey = new Date(rawDate).toISOString().substring(0, 7);
      const val =
        countOrSumKey === '_count'
          ? item._count?._all ?? item._count ?? 1
          : Number(item._sum?.amount ?? 0);

      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + val);
    }

    return Array.from(monthlyMap.entries()).map(([month, value]) => ({
      month,
      value,
    }));
  }

  async getRecentProvisionings() {
    return this.prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        user: { select: { fullName: true } },
      },
    });
  }

  // ==========================================
  //        PROFILE & AVATAR METHODS
  // ==========================================

  async updateOwnProfile(userId: string, data: UpdateOwnProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        profilePictureUrl: true,
      },
    });

    await this.auditLogService.createLog(
      { id: userId },
      {
        action: AuditAction.UPDATE_USER,
        entity: 'USER',
        entityId: userId,
        description: 'Updated own profile details',
        newValues: data,
      },
    );

    return updated;
  }

  async updateProfilePicture(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const uploadResult = await this.cloudinaryService.uploadFile(file, {
      folder: 'profile-pictures',
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profilePictureUrl: uploadResult.secure_url,
        profilePicturePublicId: uploadResult.public_id,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        profilePictureUrl: true,
      },
    });

    await this.auditLogService.createLog(
      { id: userId },
      {
        action: AuditAction.UPDATE_USER,
        entity: 'USER',
        entityId: userId,
        description: 'Updated profile picture',
        newValues: { profilePictureUrl: updated.profilePictureUrl },
      },
    );

    return updated;
  }

  // ==========================================
  //        INDIVIDUAL TARGETING METHODS
  // ==========================================

  async targetIndividualUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        emailVerified: true,
        approvalStatus: true,
        createdAt: true,
        lastLoginAt: true,
        deletedAt: true,
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            maritalStatus: true,
            isWorker: true,
            occupation: true,
            address: true,
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException(
        `User with ID ${userId} does not exist or has been removed.`,
      );
    }

    return user;
  }

  async getIndividualsByRole(targetRole: Role) {
    return this.prisma.user.findMany({
      where: {
        role: targetRole,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateIndividualStatus(
    performingAdminId: string,
    userId: string,
    data: UpdateIndividualStatusDto,
  ) {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists || userExists.deletedAt) {
      throw new NotFoundException('Target individual not found.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.UPDATE_USER,
        entity: 'USER',
        entityId: userId,
        description: `Updated status for user ${userId}`,
        oldValues: { role: userExists.role, isActive: userExists.isActive },
        newValues: data,
      },
    );

    await this.notificationsService.notify(userId, {
      title: 'Account Status Updated',
      message: `Your account details were updated by an administrator. Role: ${
        data.role ?? userExists.role
      }, Status: ${
        data.isActive !== undefined
          ? data.isActive
            ? 'Active'
            : 'Inactive'
          : userExists.isActive
          ? 'Active'
          : 'Inactive'
      }`,
    });

    return updatedUser;
  }

  async listAdmins(query: AdminQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      role: query.role ? query.role : { in: [Role.ADMIN, Role.SUPER_ADMIN] },
      ...(query.status === 'ACTIVE' ? { isActive: true } : {}),
      ...(query.status === 'SUSPENDED' ? { isActive: false } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          approvalStatus: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async toggleAdminStatus(
    performingAdminId: string,
    targetId: string,
    isActive: boolean,
  ) {
    return this.updateIndividualStatus(performingAdminId, targetId, { isActive });
  }

  async deleteAdmin(performingAdminId: string, targetId: string) {
    if (performingAdminId === targetId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.deletedAt) {
      throw new NotFoundException('Admin account not found.');
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetId },
        data: { isActive: false, deletedAt: now },
      }),
      this.prisma.member.updateMany({
        where: { userId: targetId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.DELETE_USER,
        entity: 'USER',
        entityId: targetId,
        description: `Deleted admin account for ${target.email}`,
        oldValues: { email: target.email, role: target.role },
      },
    );

    return { message: 'Admin account deleted successfully.' };
  }

  async listPendingApprovals() {
    return this.prisma.user.findMany({
      where: { approvalStatus: 'PENDING', deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveUser(performingAdminId: string, userId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.deletedAt) throw new NotFoundException('User not found.');
    if (target.approvalStatus !== 'PENDING') {
      throw new BadRequestException('This account is not pending approval.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: performingAdminId,
        approvedAt: new Date(),
      },
      select: { id: true, fullName: true, email: true, role: true },
    });

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.UPDATE_USER,
        entity: 'USER',
        entityId: userId,
        description: `Approved account for ${target.email}`,
      },
    );

    await this.notificationsService.notify(userId, {
      title: 'Account Approved',
      message: 'Your account has been approved. You can now log in.',
    });

    return updated;
  }

  async rejectUser(performingAdminId: string, userId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.deletedAt) throw new NotFoundException('User not found.');
    if (target.approvalStatus !== 'PENDING') {
      throw new BadRequestException('This account is not pending approval.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        approvalStatus: 'REJECTED',
        approvedById: performingAdminId,
        approvedAt: new Date(),
      },
      select: { id: true, fullName: true, email: true, role: true },
    });

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.UPDATE_USER,
        entity: 'USER',
        entityId: userId,
        description: `Rejected account for ${target.email}`,
      },
    );

    return updated;
  }

  async resendPendingVerification(performingAdminId: string, userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: { id: true } } },
    });
    if (!target || target.deletedAt) throw new NotFoundException('User not found.');
    if (target.emailVerified) {
      throw new ConflictException('This account is already verified.');
    }

    const authenticatedUser = await this.authUserService.mapAuthenticatedUser(target);
    await this.authEmailService.sendVerificationEmail(authenticatedUser);

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.UPDATE_USER,
        entity: 'USER',
        entityId: userId,
        description: `Resent verification email to ${target.email}`,
      },
    );

    return { message: `Verification email resent to ${target.email}.` };
  }

  async hardDeletePendingUser(performingAdminId: string, userId: string) {
    if (performingAdminId === userId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.deletedAt) throw new NotFoundException('User not found.');
    if (target.approvalStatus !== 'PENDING') {
      throw new BadRequestException(
        'Only accounts still pending approval can be permanently deleted this way. Use suspend/deactivate for active accounts.',
      );
    }

    await this.auditLogService.createLog(
      { id: performingAdminId },
      {
        action: AuditAction.DELETE_USER,
        entity: 'USER',
        entityId: userId,
        description: `Permanently deleted pending account for ${target.email}`,
        oldValues: {
          email: target.email,
          role: target.role,
          approvalStatus: target.approvalStatus,
        },
      },
    );

    await this.prisma.$transaction([
      this.prisma.member.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    return { message: 'Pending account permanently deleted.' };
  }
}