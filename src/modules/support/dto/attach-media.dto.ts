import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Length } from 'class-validator';
import { MediaType } from '../../../../app/generated/prisma/client';

export class AttachMediaDto {
  @IsNotEmpty()
  @IsString()
  @Length(2, 150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsNotEmpty()
  @IsEnum(MediaType, { message: 'Unsupported asset media classification type.' })
  type!: MediaType;

  @IsNotEmpty()
  @IsUrl({}, { message: 'Target asset location path must be a valid file storage URL.' })
  url!: string;

  @IsOptional()
  @IsUrl({}, { message: 'Thumbnail preview file path must be a valid resource URL.' })
  thumbnail?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Event relation context must be a valid UUID reference.' })
  eventId?: string;
}