import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * Standalone mentor assignment — distinct from UpdatePipelineStageDto so a
 * mentor can be assigned/changed without also forcing a stage transition.
 * At least one of mentorId (a Member) or mentorWorkerId (a Worker) should
 * be provided by the caller; both are optional here since either can be
 * used to clear the other's assignment.
 */
export class AssignMentorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mentorId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mentorWorkerId?: string;
}
