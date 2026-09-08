// dto/grade-assignment.dto.ts
import { IsString, IsNumber, Min } from 'class-validator';

export class GradeAssignmentDto {
  @IsString()
  memberId!: string;

  @IsNumber() @Min(0)
  score!: number;
}