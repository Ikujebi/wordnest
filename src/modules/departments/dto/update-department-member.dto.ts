import { IsEnum, IsOptional } from 'class-validator';
import { DepartmentRole, DepartmentStatus } from '../../../../app/generated/prisma/client';

export class UpdateDepartmentMemberDto {
  @IsOptional()
  @IsEnum(DepartmentRole)
  role?: DepartmentRole;

  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;
}