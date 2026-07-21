import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AssignPrayerRequestDto {
  @ApiProperty({
    example: '6a8d96aa-5c86-4cb6-90f8-845ddfbc59e1',
    description: 'User ID of the pastor or prayer team member assigned.',
  })
  @IsUUID()
  assignedToId!: string; // 👈 Added '!' here

  @ApiPropertyOptional({
    example:
      'Assigned to Pastor John for follow-up and intercessory support.',
    description: 'Internal assignment note.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Send an email notification to the assigned prayer team member.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyAssignee?: boolean = true;

  @ApiPropertyOptional({
    example: false,
    description:
      'Notify the requester that their prayer request has been assigned.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notifyRequester?: boolean = false;

  @ApiPropertyOptional({
    example: [
      'leader@wordtabernacle.org.ng',
      'prayerteam@wordtabernacle.org.ng',
    ],
    description:
      'Additional email recipients who should receive the assignment notification.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccEmails?: string[];
}