import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'Updated full name' })
  @IsOptional()
  @IsString()
  @Length(3, 100, { message: 'Full name must be between 3 and 100 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'Updated email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678', description: 'Updated E.164 format phone number' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(7, 20, { message: 'Phone number must be between 7 and 20 characters.' })
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Please provide a valid E.164 phone number.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.MEMBER, description: 'Updated user role' })
  @IsOptional()
  @IsEnum(Role, { message: 'Invalid user role provided.' })
  role?: Role;

  @ApiPropertyOptional({ example: true, description: 'Active status flag' })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean value.' })
  isActive?: boolean;

  @ApiPropertyOptional({ example: '1995-08-25', description: 'Date of birth in YYYY-MM-DD ISO format' })
  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid ISO date string (YYYY-MM-DD).' })
  dateOfBirth?: string;
}