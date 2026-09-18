// src/modules/admin/dto/create-account.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateAccountDto {
  @IsString({ message: 'First name must be a string.' })
  @IsNotEmpty({ message: 'First name is required.' })
  @MinLength(2, { message: 'First name must be at least 2 characters long.' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters.' })
  firstName!: string;

  @IsString({ message: 'Last name must be a string.' })
  @IsNotEmpty({ message: 'Last name is required.' })
  @MinLength(2, { message: 'Last name must be at least 2 characters long.' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters.' })
  lastName!: string;

  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters.' })
  email!: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string.' })
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Please provide a valid phone number (e.g., +2348123456789 or 08123456789).',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid date.' })
  dateOfBirth?: string;
}