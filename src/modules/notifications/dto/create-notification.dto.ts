import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
  IsBoolean,
} from 'class-validator';

import {
  NotificationType,
} from '@prisma/client';


export class CreateNotificationDto {

  /**
   * Notification title
   *
   * Example:
   * "New Prayer Request"
   */
  @IsString()
  @MaxLength(150)
  title!: string;



  /**
   * Notification message body
   */
  @IsString()
  @MaxLength(1000)
  message!: string;



  /**
   * Notification category
   */
  @IsEnum(NotificationType)
  type!: NotificationType;



  /**
   * Optional target user
   *
   * If omitted:
   * notification becomes system-wide
   */
  @IsOptional()
  @IsUUID()
  userId?: string;



  /**
   * Optional action URL
   *
   * Example:
   * /dashboard/prayer-requests/123
   */
  @IsOptional()
  @IsString()
  actionUrl?: string;



  /**
   * Optional related entity ID
   *
   * Examples:
   *
   * prayerRequestId
   * eventId
   * sermonId
   */
  @IsOptional()
  @IsUUID()
  referenceId?: string;



  /**
   * Optional sound trigger
   *
   * Frontend can use this
   * for notification sound
   */
  @IsOptional()
  @IsBoolean()
  playSound?: boolean;
}