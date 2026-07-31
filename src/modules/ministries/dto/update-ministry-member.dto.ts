import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { DepartmentStatus } from '@prisma/client';

export class UpdateMinistryMemberDto {
  @IsOptional()
  @IsString()
  roleTitle?: string;

  @IsOptional()
  @IsBoolean()
  isLeader?: boolean;

  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;
}