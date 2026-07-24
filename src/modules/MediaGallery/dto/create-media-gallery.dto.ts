import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUrl } from 'class-validator';
import { MediaType } from '@prisma/client';

export class CreateMediaGalleryDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsEnum(MediaType)
  @IsOptional()
  type?: MediaType = MediaType.IMAGE;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  url?: string;

  @IsUrl()
  @IsOptional()
  thumbnail?: string;
}