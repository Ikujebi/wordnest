import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { CreatePrayerRequestDto } from './create-prayer-request.dto';

import {
  PrayerRequestPriority,
  PrayerRequestStatus,
  PrayerRequestVisibility,
} from '@prisma/client';

export class UpdatePrayerRequestDto extends PartialType(
  CreatePrayerRequestDto,
) {
  @IsOptional()
  @IsEnum(PrayerRequestStatus)
  status?: PrayerRequestStatus;

  @IsOptional()
  @IsEnum(PrayerRequestPriority)
  priority?: PrayerRequestPriority;

  @IsOptional()
  @IsEnum(PrayerRequestVisibility)
  visibility?: PrayerRequestVisibility;

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message?: string;

  /**
   * Internal prayer team summary.
   * This is never shown to the requester.
   */
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  internalSummary?: string;

  /**
   * Public testimony or praise report.
   * Can be emailed back to the requester.
   */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  testimony?: string;

  /**
   * Marks when the prayer request
   * was acknowledged by the prayer team.
   */
  @IsOptional()
  @IsDateString()
  acknowledgedAt?: string;

  /**
   * Marks when the request
   * was answered.
   */
  @IsOptional()
  @IsDateString()
  answeredAt?: string;

  /**
   * Marks when the request
   * was closed.
   */
  @IsOptional()
  @IsDateString()
  closedAt?: string;

  /**
   * Whether a follow-up email
   * has already been sent.
   */
  @IsOptional()
  @IsBoolean()
  followUpSent?: boolean;
}