import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, Notification, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create notification
   */
  async create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({
      data,
    });
  }

  /**
   * Create multiple notifications and return created items safely
   */
  async createMany(
    notifications: Prisma.NotificationCreateManyInput[],
  ): Promise<Notification[]> {
    // Uses a transaction to create and return records safely without relying on pre-generated IDs
    return this.prisma.$transaction(
      notifications.map((data) => this.prisma.notification.create({ data })),
    );
  }

  /**
   * Find notification by ID (Supports findById and findOne)
   */
  async findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({
      where: { id },
    });
  }

  async findOne(id: string): Promise<Notification | null> {
    return this.findById(id);
  }

  /**
   * Find many with pagination, search, and filtering (expected by Service)
   */
  async findMany(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: NotificationType;
    userId?: string;
    isRead?: boolean;
  }) {
    const { page = 1, limit = 20, search, type, userId, isRead } = params;

    const where: Prisma.NotificationWhereInput = {};

    if (type) where.type = type;
    if (userId) where.userId = userId;
    if (typeof isRead === 'boolean') where.isRead = isRead;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Raw find all with generic Prisma parameters
   */
  async findAll(
    where: Prisma.NotificationWhereInput = {},
    options?: { skip?: number; take?: number },
  ) {
    return this.prisma.notification.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find user notifications
   */
  async findByUser(
    userId: string,
    options?: { skip?: number; take?: number },
  ) {
    return this.prisma.notification.findMany({
      where: { userId },
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Count notifications with optional filter criteria
   */
  async count(where: Prisma.NotificationWhereInput = {}) {
    return this.prisma.notification.count({ where });
  }

  /**
   * Get unread notifications count for a user
   */
  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Get unread notifications list
   */
  async unread(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update notification
   */
  async update(id: string, data: Prisma.NotificationUpdateInput) {
    return this.prisma.notification.update({
      where: { id },
      data,
    });
  }

  /**
   * Mark single notification as read
   */
  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Mark all user notifications as read (Supports markAllRead and markAllAsRead)
   */
  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.markAllRead(userId);
  }

  /**
   * Delete single notification
   */
  async delete(id: string) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }

  /**
   * Delete many notifications
   */
  async deleteMany(where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.deleteMany({ where });
  }

  /**
   * Cleanup old notifications
   */
  async deleteOlderThan(date: Date) {
    return this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: date },
      },
    });
  }

  /**
   * Check notification ownership
   */
  async belongsToUser(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    return !!notification;
  }
}