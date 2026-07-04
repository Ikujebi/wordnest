import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Notification, NotificationType } from '@prisma/client';

export interface DispatchNotificationDto {
  title: string;
  message: string;
  type: NotificationType;
  userId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates system alerts or transactional notification states within database structures.
   */
  async broadcastAlert(dto: DispatchNotificationDto): Promise<Notification> {
    try {
      return await this.prisma.notification.create({
        data: {
          title: dto.title,
          message: dto.message,
          type: dto.type,
          userId: dto.userId || null,
          isRead: false,
        },
      });
    } catch (error) {
      this.logger.error('System failed to process application alert message.', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Database allocation fault producing notifications.');
    }
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }
}