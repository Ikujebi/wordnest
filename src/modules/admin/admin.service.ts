// src/modules/admin/admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationService,
  ) {}

  async getDashboardStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalEvents, activeDepartments] = await Promise.all([
      this.prisma.event.count({
        where: {
          startDate: { gte: startOfToday },
          deletedAt: null,
        },
      }),
      this.prisma.department.count({
        where: { deletedAt: null },
      }),
    ]);

    return {
      totalEvents,
      activeDepartments,
    };
  }

  // ==========================================
  //         INDIVIDUAL TARGETING METHODS
  // ==========================================

  /**
   * Fetch a specific individual member's profile along with their system user credentials.
   */
  async targetIndividualMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phoneNumber: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!member || member.deletedAt) {
      throw new NotFoundException(
        `Member with ID ${memberId} does not exist or has been removed.`,
      );
    }

    return member;
  }

  /**
   * Fetch all members under administrative purview (excluding soft-deleted accounts).
   */
  async listAllMembers() {
    return this.prisma.member.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  /**
   * Update a member's status/details, record audit logs, and dispatch notifications.
   */
  async updateIndividualMemberStatus(
    performingAdminId: string,
    memberId: string,
    data: { isWorker?: boolean; isActive?: boolean; role?: Role },
  ) {
    const memberExists = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!memberExists || memberExists.deletedAt) {
      throw new NotFoundException('Target member not found.');
    }

    // 1. Update Member and connected User record if user fields are passed
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
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    // 2. Record Audit Log
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

    // 3. Dispatch Notification if the member has an attached User ID
    if (memberExists.userId) {
      await this.notificationsService.notify(memberExists.userId, {
        title: 'Member Profile Updated',
        message: 'Your member profile details were updated by an administrator.',
      });
    }

    return updatedMember;
  }
}