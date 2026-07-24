// src/notification/notification.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { NotificationType, Notification, Role, DepartmentRole } from '@prisma/client';

import { NotificationRepository } from './notification.repository';
import { NotificationGateway } from './gateways/notification.gateway';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { NotificationEvents } from './enums/notification-events.enum';
import { PrismaService } from '../../../prisma/prisma.service'; // Adjust path as needed

export interface CreateNotificationDto {
  title: string;
  message: string;
  type?: NotificationType;
  userId?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationGateway: NotificationGateway,
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  // ===========================================================================
  // TARGETED NOTIFICATION DISPATCHERS
  // ===========================================================================
  /** Generic single-user notification dispatcher */
async notify(
  userId: string,
  data: Omit<CreateNotificationDto, 'userId'>,
) {
  return this.create({
    ...data,
    userId,
    type: data.type ?? NotificationType.SYSTEM,
  });
}
  /** Send targeted notification to a specific single member */
  async notifyMember(memberId: string, data: Omit<CreateNotificationDto, 'userId'>) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { userId: true },
    });

    if (!member?.userId) {
      throw new NotFoundException(`User account not associated with member ${memberId}`);
    }

    return this.create({
      ...data,
      userId: member.userId,
      type: data.type ?? NotificationType.SYSTEM,
    });
  }
async notifyMany(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType = NotificationType.SYSTEM,
  ) {
    return this.broadcastToUsers(userIds, { title, message, type });
  }
  /** Send targeted notification to multiple members by memberIds */
  async notifyMembers(memberIds: string[], data: Omit<CreateNotificationDto, 'userId'>) {
    const members = await this.prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { userId: true },
    });

    const userIds = members.map((m) => m.userId).filter((id): id is string => Boolean(id));
    return this.broadcastToUsers(userIds, data);
  }

  /** Send notification to all active members of a specific department */
  async notifyDepartment(departmentId: string, data: Omit<CreateNotificationDto, 'userId'>) {
    const departmentMembers = await this.prisma.departmentMember.findMany({
      where: { departmentId, deletedAt: null },
      select: { member: { select: { userId: true } } },
    });

    const userIds = departmentMembers
      .map((dm) => dm.member?.userId)
      .filter((id): id is string => Boolean(id));

    return this.broadcastToUsers(userIds, data);
  }

  /** Send notification to all designated workers */
  async notifyWorkers(data: Omit<CreateNotificationDto, 'userId'>) {
    const workers = await this.prisma.member.findMany({
      where: { isWorker: true, deletedAt: null },
      select: { userId: true },
    });

    const userIds = workers.map((w) => w.userId).filter((id): id is string => Boolean(id));
    return this.broadcastToUsers(userIds, data);
  }

  /** Send notification to Department Leaders and Assistant Leaders */
  async notifyLeaders(data: Omit<CreateNotificationDto, 'userId'>) {
    const departmentLeaders = await this.prisma.departmentMember.findMany({
      where: {
        role: { in: [DepartmentRole.LEADER, DepartmentRole.ASSISTANT_LEADER] },
        deletedAt: null,
      },
      select: { member: { select: { userId: true } } },
    });

    const userIds = departmentLeaders
      .map((dl) => dl.member?.userId)
      .filter((id): id is string => Boolean(id));

    return this.broadcastToUsers(userIds, data);
  }

  /** Send notification to all active Admins */
  async notifyAdmins(data: Omit<CreateNotificationDto, 'userId'>) {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true, deletedAt: null },
      select: { id: true },
    });

    return this.broadcastToUsers(
      admins.map((a) => a.id),
      data,
    );
  }

  /** Send notification to all active Super Admins */
  async notifySuperAdmins(data: Omit<CreateNotificationDto, 'userId'>) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, isActive: true, deletedAt: null },
      select: { id: true },
    });

    return this.broadcastToUsers(
      superAdmins.map((sa) => sa.id),
      data,
    );
  }

  /** Send notification to all active users */
  async notifyEveryone(data: Omit<CreateNotificationDto, 'userId'>) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });

    return this.broadcastToUsers(
      users.map((u) => u.id),
      data,
    );
  }

  // ===========================================================================
  // CORE CREATION & BULK METHODS
  // ===========================================================================

  /** Create notification for a single user */
  async create(data: {
    userId?: string;
    title: string;
    message: string;
    type: NotificationType;
  }) {
    try {
      const notification = await this.notificationRepository.create({
        title: data.title,
        message: data.message,
        type: data.type,
        ...(data.userId && {
          user: {
            connect: { id: data.userId },
          },
        }),
      });

      this.emitCreated(notification);

      await this.auditLogService.createLog(
        { id: data.userId },
        {
          action: AuditAction.CREATE_NOTIFICATION,
          entity: 'Notification',
          entityId: notification.id,
          description: 'Notification created',
          newValues: notification,
        },
      );

      return notification;
    } catch (error) {
      this.logger.error('Failed creating notification', error);
      throw new InternalServerErrorException('Unable to create notification');
    }
  }

  /** Broadcast notification batch to multiple specific user IDs */
  async broadcastToUsers(userIds: string[], data: Omit<CreateNotificationDto, 'userId'>) {
    if (!userIds || userIds.length === 0) {
      return { message: 'No users targeted', count: 0, data: [] };
    }

    try {
      // Deduplicate user IDs
      const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

      const notificationPayloads = uniqueUserIds.map((userId) =>
        this.buildNotificationPayload({
          ...data,
          type: data.type ?? NotificationType.SYSTEM,
          userId,
        }),
      );

      const created = await this.notificationRepository.createMany(notificationPayloads);

      for (const notification of created) {
        this.emitCreated(notification);
      }

      this.logger.log(`Broadcast notification sent to ${created.length} users`);

      return {
        message: 'Notification broadcast completed',
        count: created.length,
        data: created,
      };
    } catch (error) {
      this.logError('Failed bulk user broadcast', error);
      throw new InternalServerErrorException('Unable to complete user broadcast');
    }
  }

  /** Create global/system notification without specific user targeting */
  async createSystemNotification(data: {
    title: string;
    message: string;
    type?: NotificationType;
  }) {
    try {
      const notification = await this.notificationRepository.create({
        title: data.title,
        message: data.message,
        type: data.type ?? NotificationType.SYSTEM,
      });

      this.emitSystemNotification(notification);

      return notification;
    } catch (error) {
      this.logger.error('Failed creating system notification', error);
      throw new InternalServerErrorException('Unable to create system notification');
    }
  }

  // ===========================================================================
  // QUERY & MUTATION HANDLERS
  // ===========================================================================

  /** Get notifications with pagination */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: NotificationType;
    userId?: string;
    isRead?: boolean;
  }) {
    try {
      return await this.notificationRepository.findMany(params);
    } catch (error) {
      this.logger.error('Failed fetching notifications', error);
      throw new InternalServerErrorException('Unable to fetch notifications');
    }
  }

  /** Get single notification */
  async findOne(id: string) {
    try {
      const notification = await this.notificationRepository.findById(id);

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return notification;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed fetching notification ${id}`, error);
      throw new InternalServerErrorException('Unable to fetch notification');
    }
  }

  /** Mark notification as read */
  async markAsRead(id: string) {
    try {
      const notification = await this.notificationRepository.findById(id);

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      const updated = await this.notificationRepository.update(id, {
        isRead: true,
      });

      this.emitRead(updated);

      await this.auditLogService.createLog(
        { id: updated.userId ?? undefined },
        {
          action: AuditAction.READ_NOTIFICATION,
          entity: 'Notification',
          entityId: updated.id,
          description: 'Notification marked as read',
          oldValues: notification,
          newValues: updated,
        },
      );

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed marking notification ${id} as read`, error);
      throw new InternalServerErrorException('Unable to update notification');
    }
  }

  /** Mark all user notifications as read */
  async markAllAsRead(userId: string) {
    try {
      const result = await this.notificationRepository.markAllRead(userId);

      this.notificationGateway.sendToUser(userId, {
        event: NotificationEvents.ALL_READ,
        count: 0,
      });

      return {
        message: 'All notifications marked as read',
        updated: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed marking all notifications read for ${userId}`, error);
      throw new InternalServerErrorException('Unable to update notifications');
    }
  }

  /** Get unread notification count */
  async unreadCount(userId: string) {
    try {
      const count = await this.notificationRepository.unreadCount(userId);
      return { count };
    } catch (error) {
      this.logger.error(`Failed getting unread count for ${userId}`, error);
      throw new InternalServerErrorException('Unable to get unread count');
    }
  }

  /** Delete a notification */
  async remove(id: string, userId?: string) {
    try {
      const notification = await this.notificationRepository.findById(id);

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      if (userId && notification.userId && notification.userId !== userId) {
        throw new ForbiddenException('You are not allowed to delete this notification');
      }

      const deleted = await this.notificationRepository.delete(id);

      this.emitDeleted(notification);

      await this.auditLogService.createLog(
        { id: notification.userId ?? undefined },
        {
          action: AuditAction.DELETE_NOTIFICATION,
          entity: 'Notification',
          entityId: notification.id,
          description: 'Notification deleted',
          oldValues: notification,
        },
      );

      return {
        message: 'Notification deleted successfully',
        notification: deleted,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Failed deleting notification ${id}`, error);
      throw new InternalServerErrorException('Unable to delete notification');
    }
  }

  /** Delete old notifications */
  async removeOlderThan(days = 90) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const result = await this.notificationRepository.deleteOlderThan(cutoff);

      this.logger.log(`Deleted ${result.count} notifications older than ${days} days`);

      await this.auditLogService.createLog(
        {},
        {
          action: AuditAction.DELETE_OLD_NOTIFICATIONS,
          entity: 'Notification',
          description: `Deleted notifications older than ${days} days`,
          metadata: { deleted: result.count },
        },
      );

      return {
        message: 'Old notifications removed successfully',
        deleted: result.count,
        deletedCount: result.count,
      };
    } catch (error) {
      this.logger.error('Failed deleting old notifications', error);
      throw new InternalServerErrorException('Unable to cleanup notifications');
    }
  }

  /** Fetch global notification statistics */
  async statistics() {
    try {
      const [total, unread, read] = await Promise.all([
        this.notificationRepository.count(),
        this.notificationRepository.count({ isRead: false }),
        this.notificationRepository.count({ isRead: true }),
      ]);

      return { total, unread, read };
    } catch (error) {
      this.logError('Failed fetching notification statistics', error);
      throw new InternalServerErrorException('Unable to fetch statistics');
    }
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private buildNotificationPayload(data: {
    title: string;
    message: string;
    type: NotificationType;
    userId?: string;
  }) {
    return {
      title: data.title,
      message: data.message,
      type: data.type,
      userId: data.userId ?? null,
    };
  }

  private emitCreated(notification: Notification) {
    if (!notification.userId) {
      this.notificationGateway.broadcast(notification);
      return;
    }

    this.notificationGateway.sendToUser(notification.userId, notification);
  }

  private emitRead(notification: Notification) {
    if (!notification.userId) return;

    this.notificationGateway.sendToUser(notification.userId, {
      event: NotificationEvents.READ,
      notification,
    });
  }

  private emitDeleted(notification: Notification) {
    if (!notification.userId) return;

    this.notificationGateway.sendToUser(notification.userId, {
      event: NotificationEvents.DELETED,
      notificationId: notification.id,
    });
  }

  private emitSystemNotification(notification: Notification) {
    this.notificationGateway.broadcast(notification);
  }

  private logError(message: string, error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.error(message, err.stack);
  }
  
}