import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsArray,
  ArrayUnique,
  ValidateNested,
  IsEnum,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

// 🔥 Keep your native Prisma Enums synced
import { CommunicationType, CommunicationChannel } from '@prisma/client'; 

/**
 * Nested channel configuration DTO
 *
 * Example:
 * [
 *   {
 *     channel: "EMAIL",
 *     enabled: true
 *   },
 *   {
 *     channel: "SMS",
 *     enabled: false
 *   }
 * ]
 */
export class BroadcastChannelDto {
  @IsEnum(CommunicationChannel, {
    message: 'Channel name must be a valid infrastructure communication channel (e.g., EMAIL, SMS, PUSH).',
  })
  @IsNotEmpty({
    message: 'Channel name cannot be empty.',
  })
  channel!: CommunicationChannel;

  @IsOptional()
  @IsBoolean({
    message: 'Enabled must be a boolean value.',
  })
  enabled?: boolean;
}

/**
 * Update Broadcast DTO
 *
 * Used for partial broadcast updates.
 * All fields are optional because this is an update operation.
 */
export class UpdateBroadcastDto {
  @IsOptional()
  @IsString({
    message: 'The title must be a valid text string.',
  })
  @IsNotEmpty({
    message: 'The title cannot be empty if provided.',
  })
  title?: string;

  @IsOptional()
  @IsString({
    message: 'The subject must be a valid text string.',
  })
  @IsNotEmpty({
    message: 'The subject cannot be empty if provided.',
  })
  subject?: string;

  @IsOptional()
  @IsString({
    message: 'The content must be a valid text string.',
  })
  @IsNotEmpty({
    message: 'The content cannot be empty if provided.',
  })
  content?: string;

  @IsOptional()
  @IsEnum(CommunicationType, {
    message: 'Type must be a valid system communication type enum value.',
  })
  type?: CommunicationType; 

  /**
   * Optional image attachments/media URLs associated with the broadcast
   */
  @IsOptional()
  @IsArray({
    message: 'imageUrls must be an array.',
  })
  @IsString({
    each: true,
    message: 'Each item in imageUrls must be a string.',
  })
  imageUrls?: string[];

  /**
   * Simple channels array
   *
   * Example:
   * [
   *   "EMAIL",
   *   "SMS",
   *   "PUSH"
   * ]
   */
  @IsOptional()
  @IsArray({
    message: 'Channels must be an array.',
  })
  @ArrayUnique({
    message: 'Channels cannot contain duplicate values.',
  })
  @IsEnum(CommunicationChannel, {
    each: true,
    message: 'Each channel must be a valid schema communication channel (e.g., EMAIL, SMS, PUSH).',
  })
  channels?: CommunicationChannel[];

  /**
   * Advanced channel configuration
   *
   * Example:
   * [
   *   {
   *     channel: "EMAIL",
   *     enabled: true
   *   }
   * ]
   */
  @IsOptional()
  @IsArray({
    message: 'Channel configuration must be an array.',
  })
  @ValidateNested({
    each: true,
  })
  @Type(() => BroadcastChannelDto)
  channelConfig?: BroadcastChannelDto[];

  /**
   * Schedule broadcast execution
   *
   * Example:
   * 2026-07-10T10:00:00.000Z
   */
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'scheduledAt must be a valid ISO 8601 date string.',
    },
  )
  scheduledAt?: string | null;

  /**
   * Extra dynamic information
   *
   * Example:
   * {
   *   campaign: "July Newsletter",
   *   priority: "high"
   * }
   */
  @IsOptional()
  @IsObject({
    message: 'Metadata must be an object.',
  })
  metadata?: Record<string, unknown>;
}