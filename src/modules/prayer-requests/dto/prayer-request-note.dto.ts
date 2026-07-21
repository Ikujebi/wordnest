import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PrayerRequestNoteDto {
  @ApiProperty({
    example:
      'I called the requester this afternoon. We prayed together and encouraged them with Psalm 46.',
    description: 'The prayer team note.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(5000)
  note!: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'If true, only prayer team members and administrators can see this note.',
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean = true;

  @ApiPropertyOptional({
    default: false,
    description:
      'Send this note as an encouragement email to the requester.',
  })
  @IsOptional()
  @IsBoolean()
  sendToRequester?: boolean = false;

  @ApiPropertyOptional({
    default: false,
    description:
      'Send this note to every member of the assigned prayer team.',
  })
  @IsOptional()
  @IsBoolean()
  notifyPrayerTeam?: boolean = false;

  @ApiPropertyOptional({
    example: 'We will continue praying with you this week. Remain encouraged.',
    description:
      'Optional email message sent to the requester instead of the internal note.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requesterMessage?: string;
}