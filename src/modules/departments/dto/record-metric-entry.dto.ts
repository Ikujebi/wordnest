import { IsString, IsNumber, IsUUID, Min, IsNotEmpty } from 'class-validator';

export class RecordMetricEntryDto {
  @IsUUID()
  @IsNotEmpty()
  metricId!: string;

  @IsNumber()
  @Min(0)
  achievedValue!: number;

  @IsString()
  @IsNotEmpty()
  period!: string; // e.g., "2026-Q3", "2026-07"
}