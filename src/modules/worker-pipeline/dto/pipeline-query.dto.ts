import { IsOptional, IsString, IsEnum } from 'class-validator';
import { WorkerTrainingStage } from '@prisma/client';

export class PipelineQueryDto {
  @IsOptional()
  @IsEnum(WorkerTrainingStage)
  stage?: WorkerTrainingStage;

  @IsOptional()
  @IsString()
  search?: string; // matches against member firstName/lastName/email
}