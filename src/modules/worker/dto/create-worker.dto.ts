import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateWorkerDto {
  @IsString()
  memberId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  ministryId?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}