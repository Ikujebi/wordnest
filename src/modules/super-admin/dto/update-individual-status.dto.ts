// src/super-admin/dto/update-individual-status.dto.ts
import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateIndividualStatusDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}