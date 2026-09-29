import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepartmentMetricBreakdownDto {
  @ApiProperty({
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    description: 'Unique identifier for the metric question',
  })
  metricId!: string;

  @ApiProperty({
    example: 'Did the department hold weekly meetings?',
    description: 'The performance question evaluated',
  })
  question!: string;

  @ApiProperty({
    example: 10,
    description: 'Weight of the metric towards total score',
  })
  weight!: number;

  @ApiProperty({
    example: 8.5,
    nullable: true,
    description: 'Rating achieved, or null if unrated',
  })
  rating!: number | null;
}

export class DepartmentPerformanceDto {
  @ApiProperty({
    example: 'b7f3b3a4-6a4b-4b72-9b0d-3d8fd0d4c9d8',
  })
  id!: string;

  @ApiProperty({
    example: 'Choir',
  })
  name!: string;

  @ApiProperty({
    example: 'Bro. John Doe',
    nullable: true,
  })
  leader!: string | null;

  @ApiProperty({
    example: 45,
  })
  totalMembers!: number;

  @ApiProperty({
    example: 39,
  })
  activeMembers!: number;

  @ApiProperty({
    example: 6,
  })
  inactiveMembers!: number;

  @ApiProperty({
    example: 24,
  })
  workers!: number;

  @ApiProperty({
    example: 8,
  })
  trainees!: number;

  @ApiProperty({
    example: 92,
    minimum: 0,
    maximum: 100,
    description: 'Overall department performance percentage.',
  })
  completionRate!: number;

  @ApiPropertyOptional({
    type: [DepartmentMetricBreakdownDto],
    description: 'Per-question breakdown for the period.',
  })
  breakdown?: DepartmentMetricBreakdownDto[];
}