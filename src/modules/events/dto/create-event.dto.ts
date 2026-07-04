import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateEventDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsString()
  @Length(2, 255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location?: string;

  @IsNotEmpty()
  @IsDateString({}, { message: 'Start date must be a valid ISO 8601 date string.' })
  startDate!: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO 8601 date string.' })
  endDate?: string;

  @IsOptional()
  @IsString()
  bannerImage?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}