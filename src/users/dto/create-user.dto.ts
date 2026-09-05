import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email!: string;

  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Full name must be at least 3 characters long.' })
  @MaxLength(100, { message: 'Full name cannot exceed 100 characters.' })
  fullName!: string;

  @ApiPropertyOptional({ example: '+2348012345678', description: 'User phone number' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.MEMBER, description: 'User system role' })
  @IsOptional()
  @IsEnum(Role, { message: 'Invalid user role provided.' })
  role?: Role;

  @ApiProperty({ example: 'StrongPassword123!', description: 'User account password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(50, { message: 'Password cannot exceed 50 characters.' })
  password!: string;

  @ApiPropertyOptional({ example: '1995-08-25', description: 'Date of birth in YYYY-MM-DD ISO format' })
  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid ISO date string (YYYY-MM-DD).' })
  dateOfBirth?: string;
}