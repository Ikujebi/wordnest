import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  //          GLOBAL DASHBOARD METHODS
  // ==========================================

  async getDashboardStats() {
    const now = new Date();

    // Time boundary definitions (UTC)
    const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    const [
      // --- OVERVIEW COUNTS ---
      totalMembers,
      activeWorkers,
      totalAdmins,
      totalDepartments,
      totalEvents,
      totalSermons,
      unreadMessages,
      pendingPrayerRequests,
      currentMonthlyGiving,

      // --- PRIOR MONTH COUNTS (For Growth Calculations) ---
      prevMembersCount,
      prevWorkersCount,
      prevGivingSum,
      prevEventsCount,

      // --- HISTORICAL CHART DATA ---
      membersChartRaw,
      givingChartRaw,
      attendanceChartRaw,

      // --- RECENT ACTIVITIES ---
      auditLogs,
      latestMembers,
      latestPrayerRequests,
      latestMessages,
      latestEvents,
    ] = await Promise.all([
      // 1. Total Members
      this.prisma.member.count({ where: { deletedAt: null } }),

      // 2. Active Workers
      this.prisma.member.count({ where: { isWorker: true, deletedAt: null } }),

      // 3. Total Admins
      this.prisma.user.count({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, deletedAt: null },
      }),

      // 4. Total Departments
      this.prisma.department.count({ where: { deletedAt: null } }),

      // 5. Total Events
      this.prisma.event.count({ where: { deletedAt: null } }),

      // 6. Total Sermons
      this.prisma.sermon.count({ where: { deletedAt: null } }),

      // 7. Unread Messages
      this.prisma.contactMessage.count({ where: { isRead: false, deletedAt: null } }),

      // 8. Pending Prayer Requests
      this.prisma.prayerRequest.count({ where: { status: 'PENDING', deletedAt: null } }),

      // 9. Current Month Giving Sum
      this.prisma.giving.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: startOfCurrentMonth }, deletedAt: null },
      }),

      // --- GROWTH BENCHMARKS ---
      // 10. Members prior to current month
      this.prisma.member.count({
        where: { createdAt: { lt: startOfCurrentMonth }, deletedAt: null },
      }),

      // 11. Workers prior to current month
      this.prisma.member.count({
        where: {
          isWorker: true,
          createdAt: { lt: startOfCurrentMonth },
          deletedAt: null,
        },
      }),

      // 12. Giving sum in previous month
      this.prisma.giving.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth },
          deletedAt: null,
        },
      }),

      // 13. Events prior to current month
      this.prisma.event.count({
        where: { createdAt: { lt: startOfCurrentMonth }, deletedAt: null },
      }),

      // --- CHARTS DATA ---
      // 14. Monthly Member Signups (Last 6 Months)
      this.prisma.member.groupBy({
        by: ['createdAt'],
        _count: { _all: true },
        where: { createdAt: { gte: sixMonthsAgo }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),

      // 15. Monthly Giving Totals (Last 6 Months)
      this.prisma.giving.groupBy({
        by: ['createdAt'],
        _sum: { amount: true },
        where: { createdAt: { gte: sixMonthsAgo }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),

      // 16. Event Attendance (Recent completed/past events)
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

      // --- RECENT LISTS ---
      // 17. Recent Audit Logs
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

      // 18. Latest Members
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

      // 19. Latest Prayer Requests
      this.prisma.prayerRequest.findMany({
        take: 5,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          subject: true,
          status: true,
          createdAt: true,
        },
      }),

      // 20. Latest Contact Messages
      this.prisma.contactMessage.findMany({
        take: 5,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          subject: true,
          isRead: true,
          createdAt: true,
        },
      }),

      // 21. Latest/Upcoming Events
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

    // Helper: Compute Percentage Growth
    const computeGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const currentGivingVal = Number(currentMonthlyGiving._sum.amount ?? 0);
    const prevGivingVal = Number(prevGivingSum._sum.amount ?? 0);

    const memberGrowthVal = totalMembers - prevMembersCount;
    const workerGrowthVal = activeWorkers - prevWorkersCount;
    const eventGrowthVal = totalEvents - prevEventsCount;

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

  // Helper method to bucket raw aggregate timestamps into "YYYY-MM"
  private groupDataByMonth(data: any[], countOrSumKey: '_count' | '_sum') {
    const monthlyMap = new Map<string, number>();

    for (const item of data) {
      const monthKey = new Date(item.createdAt).toISOString().substring(0, 7); // "YYYY-MM"
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
      throw new NotFoundException(`User with ID ${userId} does not exist or has been removed.`);
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

  async updateIndividualStatus(userId: string, data: { role?: Role; isActive?: boolean }) {
    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists || userExists.deletedAt) {
      throw new NotFoundException('Target individual not found.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });
  }
}