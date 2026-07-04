import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SubmitMessageDto {
  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid sender email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must follow standard E.164 formats.' })
  phoneNumber?: string;

  @IsNotEmpty()
  @IsString()
  @Length(3, 150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  subject!: string;

  @IsNotEmpty()
  @IsString()
  @Length(10, 2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message!: string;
}