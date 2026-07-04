import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class ApplyTrainingDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Member ID reference must be a valid UUID.' })
  memberId!: string;

  @IsNotEmpty()
  @IsUUID('4', { message: 'Target Department ID reference must be a valid UUID.' })
  departmentId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Mentor Member ID must be a valid UUID.' })
  mentorId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Mentor Worker ID must be a valid UUID.' })
  mentorWorkerId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}