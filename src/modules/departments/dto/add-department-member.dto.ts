import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { DepartmentRole, DepartmentStatus } from '../../../../app/generated/prisma/client';

export class AddDepartmentMemberDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Member ID must be a valid UUID.' })
  memberId!: string;

  @IsNotEmpty()
  @IsEnum(DepartmentRole)
  role!: DepartmentRole;

  @IsNotEmpty()
  @IsEnum(DepartmentStatus)
  status!: DepartmentStatus;
}