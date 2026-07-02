import {
  IsEmail,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class ForgotPasswordDto {
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
}