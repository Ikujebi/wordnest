import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Full name must be at least 3 characters long.' })
  @MaxLength(100, { message: 'Full name cannot exceed 100 characters.' })
  fullName!: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Invalid user role provided.' })
  role?: Role;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(50, { message: 'Password cannot exceed 50 characters.' })
  password!: string;
}