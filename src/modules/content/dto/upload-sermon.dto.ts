import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UploadSermonDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  preacher!: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  scriptureText?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  summary?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Video streaming locator must be a valid resource URL string.' })
  videoUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Audio stream locator must be a valid resource URL string.' })
  audioUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Thumbnail image path must be a valid resource URL string.' })
  thumbnailUrl?: string;

  @IsNotEmpty()
  @IsDateString({}, { message: 'Sermon delivery date index must be a valid ISO 8601 string.' })
  sermonDate!: string;
}