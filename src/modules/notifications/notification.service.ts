import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';

import { NotificationType, Notification, Prisma } from '@prisma/client';

import { NotificationRepository } from './notification.repository';
import { NotificationGateway } from './gateways/notification.gateway';

export interface CreateNotificationDto {
  title: string;
  message: string;
  type: NotificationType;
  userId?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * Create notification for a single user
   */
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
            connect: {
              id: data.userId,
            },
          },
        }),
      });

      /**
       * Push notification instantly
       * through Socket.IO gateway
       */
      if (data.userId) {
        this.notificationGateway.sendToUser(data.userId, notification);
      }

      this.emitCreated(notification);

      return notification;
    } catch (error) {
      this.logger.error('Failed creating notification', error);

      throw new InternalServerErrorException('Unable to create notification');
    }
  }

  /**
   * Create notifications for multiple users
   *
   * Example:
   * New sermon uploaded
   * → Notify all members
   */
  async createForUsers(
    userIds: string[],
    data: {
      title: string;
      message: string;
      type: NotificationType;
    },
  ) {
    if (!userIds.length) {
      throw new BadRequestException('No users provided');
    }

    try {
      const notifications = await Promise.all(
        userIds.map((userId) =>
          this.notificationRepository.create({
            title: data.title,
            message: data.message,
            type: data.type,

            user: {
              connect: {
                id: userId,
              },
            },
          }),
        ),
      );

      /**
       * Real-time push
       */
      notifications.forEach((notification) => {
        if (notification.userId) {
          this.notificationGateway.sendToUser(
            notification.userId,
            notification,
          );
        }
        this.emitCreated(notification);
      });

      return notifications;
    } catch (error) {
      this.logger.error('Failed creating bulk notifications', error);

      throw new InternalServerErrorException('Unable to create notifications');
    }
  }

  /**
   * Create global/system notification
   *
   * Used for:
   * - Emergency announcements
   * - Maintenance messages
   * - Church-wide alerts
   * - Public updates
   *
   * This creates a notification
   * without attaching it to a user.
   */
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

      /**
       * Broadcast to every
       * connected client
       */
      this.notificationGateway.broadcast(notification);
      this.emitSystemNotification(notification);

      return notification;
    } catch (error) {
      this.logger.error('Failed creating system notification', error);

      throw new InternalServerErrorException(
        'Unable to create system notification',
      );
    }
  }

  /**
   * Get notifications with pagination
   *
   * Supports:
   * - Search
   * - Filtering by type
   * - Filtering by read status
   * - Filtering by user
   */
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

  /**
   * Get single notification
   */
  async findOne(id: string) {
    try {
      const notification = await this.notificationRepository.findById(id);

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return notification;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed fetching notification ${id}`, error);

      throw new InternalServerErrorException('Unable to fetch notification');
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string) {
    try {
      const notification = await this.notificationRepository.findById(id);

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      const updated = await this.notificationRepository.update(id, {
        isRead: true,
      });

      /**
       * Notify client that
       * notification state changed
       */
      if (updated.userId) {
        this.notificationGateway.sendToUser(updated.userId, {
          event: 'notification.read',
          notification: updated,
        });
      }

      this.emitRead(updated);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed marking notification ${id} as read`, error);

      throw new InternalServerErrorException('Unable to update notification');
    }
  }

  /**
   * Mark all user notifications as read
   */
  async markAllAsRead(userId: string) {
    try {
      const result = await this.notificationRepository.markAllRead(userId);

      /**
       * Notify frontend
       * to refresh notification badge
       */
      this.notificationGateway.sendToUser(userId, {
        event: 'notification.all_read',
        count: 0,
      });

      return {
        message: 'All notifications marked as read',

        updated: result.count,
      };
    } catch (error) {
      this.logger.error(
        `Failed marking all notifications read for ${userId}`,
        error,
      );

      throw new InternalServerErrorException('Unable to update notifications');
    }
  }

  /**
   * Get unread notification count
   *
   * Used by:
   * - Dashboard header badge
   * - Mobile app notification icon
   */
  async unreadCount(userId: string) {
    try {
      const count = await this.notificationRepository.unreadCount(userId);

      return {
        count,
      };
    } catch (error) {
      this.logger.error(
        `Failed getting unread count for ${userId}`,
        error,
      );

      throw new InternalServerErrorException('Unable to get unread count');
    }
  }

  /**
   * Delete a notification
   *
   * Used when:
   * - User removes notification manually
   * - Admin clears system notification
   * - Optional ownership verification
   */
  async remove(id: string, userId?: string) {
    try {
      const notification = await this.notificationRepository.findById(id);

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      if (
        userId &&
        notification.userId &&
        notification.userId !== userId
      ) {
        throw new ForbiddenException(
          'You are not allowed to delete this notification',
        );
      }

      const deleted = await this.notificationRepository.delete(id);

      /**
       * Inform connected client
       */
      if (notification.userId) {
        this.notificationGateway.sendToUser(notification.userId, {
          event: 'notification.deleted',

          notificationId: id,
        });
      }

      this.emitDeleted(notification);

      return {
        message: 'Notification deleted successfully',

        notification: deleted,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(`Failed deleting notification ${id}`, error);

      throw new InternalServerErrorException('Unable to delete notification');
    }
  }

  /**
   * Delete old notifications
   *
   * Used by scheduler/cron jobs.
   *
   * Example:
   * Delete notifications older than 90 days
   */
  async removeOlderThan(days = 90) {
    try {
      const cutoff = new Date();

      cutoff.setDate(cutoff.getDate() - days);

      const result = await this.notificationRepository.deleteOlderThan(cutoff);

      this.logger.log(
        `Deleted ${result.count} notifications older than ${days} days`,
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

  /**
   * Create notification internally
   *
   * Prevents duplicate logic
   * when other modules need
   * notification creation.
   *
   * Example:
   * - PrayerRequestService
   * - EventService
   * - CommunicationService
   */
  async notify(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
  ) {
    return this.create({
      userId,
      title,
      message,
      type,
    });
  }

  /**
   * Notify multiple users
   *
   * Shortcut wrapper
   */
  async notifyMany(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
  ) {
    return this.createForUsers(userIds, {
      title,
      message,
      type,
    });
  }

  /**
   * Broadcast notification to system
   *
   * Used for:
   * - Church announcement
   * - Emergency alert
   * - System maintenance
   */
  async broadcastSystem(
    title: string,
    message: string,
    type: NotificationType = NotificationType.SYSTEM,
  ) {
    return this.createSystemNotification({
      title,
      message,
      type,
    });
  }

  /**
   * Send notification batch to multiple specific user IDs
   */
  async broadcastToUsers(
    userIds: string[],
    data: CreateNotificationDto,
  ) {
    try {
      const notifications = userIds.map((userId) =>
        this.buildNotificationPayload({
          ...data,
          userId,
        }),
      );

      const created = await this.notificationRepository.createMany(
        notifications,
      );

      for (const notification of created) {
        this.emitCreated(notification);
      }

      this.logger.log(
        `Broadcast notification sent to ${userIds.length} users`,
      );

      return {
        message: 'Notification broadcast completed',
        count: created.length,
        data: created,
      };
    } catch (error) {
      this.logError('Failed bulk user broadcast', error);
      throw new InternalServerErrorException(
        'Unable to complete user broadcast',
      );
    }
  }

  /**
   * Notification statistics
   */
  async statistics() {
    try {
      const [total, unread, read] = await Promise.all([
        this.notificationRepository.count(),

        this.notificationRepository.count({
          isRead: false,
        }),

        this.notificationRepository.count({
          isRead: true,
        }),
      ]);

      return {
        total,
        unread,
        read,
      };
    } catch (error) {
      this.logError('Failed fetching notification statistics', error);
      throw new InternalServerErrorException('Unable to fetch statistics');
    }
  }

  /**
   * Validate notification ownership
   *
   * Prevents users from
   * modifying other users'
   * notifications.
   */
  private async validateOwnership(
    notificationId: string,
    userId: string,
  ) {
    const notification = await this.notificationRepository.findById(
      notificationId,
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (
      notification.userId &&
      notification.userId !== userId
    ) {
      throw new BadRequestException('You cannot modify this notification');
    }

    return notification;
  }

  /**
   * Emit notification event
   *
   * Centralized Socket.IO helper.
   */
  private emit(userId: string, event: string, payload: any) {
    this.notificationGateway.sendToUser(userId, {
      event,
      data: payload,
    });
  }

  /**
   * Create notification payload helper
   */
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

  /**
   * Emit newly created notification
   */
  private emitCreated(notification: Notification) {
    if (!notification.userId) {
      this.notificationGateway.broadcast(notification);
      return;
    }

    this.notificationGateway.sendToUser(
      notification.userId,
      notification,
    );
  }

  /**
   * Emit read event
   */
  private emitRead(notification: Notification) {
    if (!notification.userId) {
      return;
    }

    this.notificationGateway.sendToUser(
      notification.userId,
      notification,
    );
  }

  /**
   * Emit deleted event
   */
  private emitDeleted(notification: Notification) {
    if (!notification.userId) {
      return;
    }

    this.notificationGateway.sendToUser(
      notification.userId,
      {
        id: notification.id,
      },
    );
  }

  /**
   * Broadcast system notifications helper
   */
  private emitSystemNotification(notification: Notification) {
    this.notificationGateway.broadcast(notification);
  }

  /**
   * Log notification activity
   */
  private logActivity(action: string, metadata?: any) {
    this.logger.log(`[Notification] ${action}`);

    if (metadata) {
      this.logger.debug(JSON.stringify(metadata));
    }
  }

  /**
   * Internal logger wrapper
   */
  private logError(message: string, error: unknown) {
    const err =
      error instanceof Error ? error : new Error(String(error));

    this.logger.error(message, err.stack);
  }
}