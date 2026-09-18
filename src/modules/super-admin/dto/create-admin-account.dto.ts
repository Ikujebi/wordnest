import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class CreateAdminAccountDto {
  @IsNotEmpty({ message: 'Full name is required.' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  fullName!: string;

  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Please provide a valid phone number (e.g., +2348123456789 or 08123456789).',
  })
  phoneNumber?: string;

  @IsNotEmpty({ message: 'Role is required.' })
  @IsIn([Role.ADMIN, Role.SUPER_ADMIN], { message: 'Role must be ADMIN or SUPER_ADMIN.' })
  role!: typeof Role.ADMIN | typeof Role.SUPER_ADMIN;
}