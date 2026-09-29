// dto/create-department-metric.dto.ts
import { IsString, IsOptional, IsUUID, IsInt, Min, Max, MaxLength, MinLength } from 'class-validator';

export class CreateDepartmentMetricDto {
  @IsOptional() @IsUUID()
  questionId?: string;          // reuse an existing question

  @IsOptional() @IsString() @MinLength(3) @MaxLength(300)
  questionText?: string;        // or create a new one inline

  @IsOptional() @IsInt() @Min(1) @Max(100)
  weight?: number;              // required only in CUSTOM mode
}