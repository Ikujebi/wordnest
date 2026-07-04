import { IsEnum, IsOptional } from 'class-validator';
import { DepartmentRole, DepartmentStatus } from '@prisma/client';

export class UpdateDepartmentMemberDto {
  @IsOptional()
  @IsEnum(DepartmentRole)
  role?: DepartmentRole;

  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;
}