import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { WorkerTrainingStage } from '../../../../app/generated/prisma/client';

export class UpdatePipelineStageDto {
  @IsNotEmpty()
  @IsEnum(WorkerTrainingStage, { message: 'Invalid worker training onboarding stage target.' })
  stage!: WorkerTrainingStage;

  @IsOptional()
  @IsUUID('4', { message: 'Leadership Class ID tracking association must be a valid UUID.' })
  leadershipClassId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}