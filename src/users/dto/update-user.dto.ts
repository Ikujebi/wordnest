import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Role } from '@prisma/client'; // Adjusted to match your CreateUserDto path

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 100, { message: 'Full name must be between 3 and 100 characters.' }) // Matches CreateUserDto constraints
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(7, 20, { message: 'Phone number must be between 7 and 20 characters.' })
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Please provide a valid E.164 phone number.' }) // Validates international phone formats
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Invalid user role provided.' })
  role?: Role;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean value.' })
  isActive?: boolean;
}