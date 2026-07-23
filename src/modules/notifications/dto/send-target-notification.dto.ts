// src/notification/dto/send-target-notification.dto.ts
import { NotificationType } from '@prisma/client';

export interface TargetNotificationPayload {
  title: string;
  message: string;
  type?: NotificationType; // Defaults to NotificationType.SYSTEM or ANNOUNCEMENT
}