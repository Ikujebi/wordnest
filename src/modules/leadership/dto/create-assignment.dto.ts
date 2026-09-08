// dto/create-assignment.dto.ts
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  title!: string;

  @IsOptional() @IsNumber() @Min(1)
  maxScore?: number;
}