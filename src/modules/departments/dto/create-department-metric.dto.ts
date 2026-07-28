// dto/create-department-metric.dto.ts
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateDepartmentMetricDto {
  @IsString()
  title!: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  weight!: number; // Percentage contribution (e.g., 40)

  @IsNumber()
  @Min(1)
  targetValue!: number;
}