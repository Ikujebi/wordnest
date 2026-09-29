// dto/set-department-metrics.dto.ts
import { IsArray, IsEnum, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { MetricWeightingMode } from '@prisma/client';
import { CreateDepartmentMetricDto } from './create-department-metric.dto';

export class SetDepartmentMetricsDto {
  @IsEnum(MetricWeightingMode)
  weightingMode!: MetricWeightingMode;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => CreateDepartmentMetricDto)
  metrics!: CreateDepartmentMetricDto[];
}