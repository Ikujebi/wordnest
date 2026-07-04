import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

export class UpdateProgressDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}