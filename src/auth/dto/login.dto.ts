import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
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
  password!: string;
}