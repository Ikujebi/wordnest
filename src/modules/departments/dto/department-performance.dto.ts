import { ApiProperty } from '@nestjs/swagger';

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
}