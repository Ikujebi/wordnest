import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({
    message: 'Full name is required.',
  })
  @IsString({
    message: 'Full name must be a string.',
  })
  @MinLength(2, {
    message: 'Full name must be at least 2 characters long.',
  })
  @MaxLength(100, {
    message: 'Full name cannot exceed 100 characters.',
  })
  fullName!: string;

  @IsNotEmpty({
    message: 'Email is required.',
  })
  @IsEmail(
    {},
    {
      message: 'Please provide a valid email address.',
    },
  )
  @MaxLength(255, {
    message: 'Email cannot exceed 255 characters.',
  })
  email!: string;

  @IsOptional()
  @IsString({
    message: 'Phone number must be a string.',
  })
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Please provide a valid phone number (e.g., +2348123456789 or 08123456789).',
  })
  phoneNumber?: string;

  @IsNotEmpty({
    message: 'Password is required.',
  })
  @IsString({
    message: 'Password must be a string.',
  })
  @MinLength(8, {
    message: 'Password must be at least 8 characters long.',
  })
  @MaxLength(128, {
    message: 'Password cannot exceed 128 characters.',
  })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=\[\]{};:'",.<>\/\\|`~]).{8,128}$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  password!: string;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

  @IsOptional()
  @IsString()
  profilePicturePublicId?: string;
}