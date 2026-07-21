import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

import {
  Type,
} from 'class-transformer';

import {
  NotificationType,
} from '@prisma/client';


export class NotificationQueryDto {


  /**
   * Pagination page
   *
   * Default:
   * page 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;



  /**
   * Number of records per page
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;



  /**
   * Filter by notification type
   *
   * Example:
   * PRAYER
   * EVENT
   * SERMON
   */
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;



  /**
   * Read/unread filter
   *
   * true:
   * read notifications
   *
   * false:
   * unread notifications
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRead?: boolean;



  /**
   * Search title/message
   *
   * Example:
   * "prayer"
   * "service"
   */
  @IsOptional()
  @IsString()
  search?: string;



  /**
   * Created after date
   */
  @IsOptional()
  @IsDateString()
  from?: string;



  /**
   * Created before date
   */
  @IsOptional()
  @IsDateString()
  to?: string;



  /**
   * Specific user filter
   *
   * Mainly for admins
   */
  @IsOptional()
  @IsString()
  userId?: string;
}