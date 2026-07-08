import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class SendNewsletterDto {
  @IsOptional()
  @IsString({ message: 'The subject must be a valid text string.' })
  @IsNotEmpty({ message: 'The subject cannot be an empty string if provided.' })
  @MaxLength(255, { message: 'The subject cannot exceed 255 characters.' })
  subject?: string;
}