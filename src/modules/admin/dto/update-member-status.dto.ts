import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateMemberStatusDto {
  @IsOptional() @IsBoolean()
  isWorker?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsEnum(Role)
  role?: Role;
}