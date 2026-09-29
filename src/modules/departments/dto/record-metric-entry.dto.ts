// dto/record-metric-entry.dto.ts
import { IsString, IsInt, IsUUID, Min, Max, IsNotEmpty } from 'class-validator';

export class RecordMetricEntryDto {
  @IsUUID() @IsNotEmpty()
  metricId!: string;

  @IsInt() @Min(1) @Max(10)
  rating!: number;

  @IsString() @IsNotEmpty()
  period!: string;
}