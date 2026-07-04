import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { LeadershipLevel } from '../../../../app/generated/prisma/client';

export class CreateClassDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsNotEmpty()
  @IsEnum(LeadershipLevel, { message: 'Invalid leadership course level classification chosen.' })
  level!: LeadershipLevel;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'Facilitator reference must be a valid UUID.' })
  facilitatorId?: string;
}