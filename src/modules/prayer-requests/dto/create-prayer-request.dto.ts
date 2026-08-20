import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  PrayerRequestCategory,
  PrayerRequestPriority,
  PrayerRequestVisibility,
} from '@prisma/client';

export class CreatePrayerRequestDto {
  @ApiProperty({
    example: 'John',
    description: 'Requester first name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Requester last name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+2348012345678',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiProperty({
    example: 'Prayer for Healing',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    example:
      'Please pray for my mother who is scheduled for surgery next week.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({
    enum: PrayerRequestCategory,
    default: PrayerRequestCategory.OTHER,
  })
  @IsOptional()
  @IsEnum(PrayerRequestCategory)
  category?: PrayerRequestCategory;

  @ApiPropertyOptional({
    enum: PrayerRequestPriority,
    default: PrayerRequestPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(PrayerRequestPriority)
  priority?: PrayerRequestPriority;

  @ApiPropertyOptional({
    enum: PrayerRequestVisibility,
    default: PrayerRequestVisibility.PRIVATE,
  })
  @IsOptional()
  @IsEnum(PrayerRequestVisibility)
  visibility?: PrayerRequestVisibility;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether the requester would like the prayer team to contact them.',
  })
  @IsOptional()
  @IsBoolean()
  allowFollowUp?: boolean;

  @ApiPropertyOptional({
    example: 'EMAIL',
    description: 'Preferred contact method',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredContactMethod?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether this requester is already a member of the church.',
  })
  @IsOptional()
  @IsBoolean()
  isMember?: boolean;

  @ApiPropertyOptional({
    example:
      'Available after 6pm weekdays. Please do not call during work hours.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  additionalNotes?: string;

    @ApiPropertyOptional({
    example: false,
    description: 'If true, do not link this request to the submitter\'s account or member profile, even if they are logged in or their email matches an existing member.',
  })
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;
}