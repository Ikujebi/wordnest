import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  PrayerRequestCategory,
  PrayerRequestPriority,
  PrayerRequestStatus,
  PrayerRequestVisibility,
} from '@prisma/client';

export class PrayerRequestEntity {
  @ApiProperty({
    example: '5f7fdfc3-c873-48e4-a85f-44a45efcf7ef',
  })
  id!: string;

  @ApiPropertyOptional({
    example: '6b61d5c7-f46b-46f4-8e57-b6d2780b43c4',
  })
  requesterId?: string | null;

  @ApiPropertyOptional({
    example: 'fd87965b-59e7-4c08-bb61-18cc08e4d9f1',
  })
  memberId?: string | null;

  @ApiProperty({
    example: 'John',
  })
  firstName!: string;

  @ApiProperty({
    example: 'Doe',
  })
  lastName!: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
  })
  email?: string | null;

  @ApiPropertyOptional({
    example: '+2348012345678',
  })
  phoneNumber?: string | null;

  @ApiProperty({
    example: 'Prayer for Healing',
  })
  subject!: string;

  @ApiProperty({
    example:
      'Please pray for my mother who is scheduled for surgery this week.',
  })
  message!: string;

  @ApiProperty({
    enum: PrayerRequestCategory,
  })
  category!: PrayerRequestCategory;

  @ApiProperty({
    enum: PrayerRequestPriority,
  })
  priority!: PrayerRequestPriority;

  @ApiProperty({
    enum: PrayerRequestVisibility,
  })
  visibility!: PrayerRequestVisibility;

  @ApiProperty({
    example: true,
  })
  isConfidential!: boolean;

  @ApiProperty({
    enum: PrayerRequestStatus,
  })
  status!: PrayerRequestStatus;

  @ApiPropertyOptional({
    example: '2fd1a2a5-6674-47d3-8d6d-4c1dc8d8ef18',
  })
  assignedToId?: string | null;

  @ApiPropertyOptional({
    example: 'Pastor Samuel Johnson',
  })
  assignedToName?: string | null;

  @ApiPropertyOptional({
    example: '4a5b8e1b-f7f3-4a42-b59d-62e2c91d56ad',
  })
  answeredById?: string | null;

  @ApiPropertyOptional({
    example:
      'The requester testified that the surgery was successful and recovery has begun.',
  })
  testimony?: string | null;

  @ApiPropertyOptional({
    example:
      'Prayer team contacted the family. Daily follow-up has been scheduled.',
  })
  internalSummary?: string | null;

  @ApiPropertyOptional()
  acknowledgedAt?: Date | null;

  @ApiPropertyOptional()
  answeredAt?: Date | null;

  @ApiPropertyOptional()
  closedAt?: Date | null;

  @ApiPropertyOptional({
    example: false,
  })
  followUpSent?: boolean;

  @ApiProperty({
    example: '2026-07-21T10:15:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-07-22T08:45:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt?: Date | null;

  /**
   * Optional relation data
   * Include these in Prisma only when requested.
   */

  @ApiPropertyOptional({
    example: 4,
    description: 'Number of notes attached to this prayer request.',
  })
  notesCount?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Number of communications sent regarding this request.',
  })
  communicationsCount?: number;
}