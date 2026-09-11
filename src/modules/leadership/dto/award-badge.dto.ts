import { IsEnum, IsString, IsOptional } from 'class-validator';
import { LeadershipLevel } from '@prisma/client';

export class AwardBadgeDto {
  @IsString()
  memberId!: string;

  @IsEnum(LeadershipLevel)
  level!: LeadershipLevel;

  @IsOptional()
  @IsString()
  reason?: string; // e.g. "Completed leadership training prior to system adoption"
}