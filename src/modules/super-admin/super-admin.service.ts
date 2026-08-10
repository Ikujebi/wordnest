import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationService,
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

  private groupDataByMonth(data: any[], countOrSumKey: '_count' | '_sum') {
    const monthlyMap = new Map<string, number>();

    for (const item of data) {
      const monthKey = new Date(item.createdAt).toISOString().substring(0, 7);
      const val =
        countOrSumKey === '_count'
          ? item._count._all ?? 1
          : Number(item._sum.amount ?? 0);

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
    data: { role?: Role; isActive?: boolean },
  ) {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists || userExists.deletedAt) {
      throw new NotFoundException('Target individual not found.');
    }

    // 1. Update User Record
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

    // 2. Trigger Audit Log via AuditLogService.createLog
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

    // 3. Trigger Notification via NotificationService.notify
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
}