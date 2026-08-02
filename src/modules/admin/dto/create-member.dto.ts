import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsBoolean } from 'class-validator';
import { Gender, MaritalStatus } from '@prisma/client';

export class CreateMemberDto {
  @IsString() @IsNotEmpty()
  firstName!: string;

  @IsString() @IsNotEmpty()
  lastName!: string;

  @IsOptional() @IsString()
  otherName?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  phoneNumber?: string;

  @IsOptional() @IsEnum(Gender)
  gender?: Gender;

  @IsOptional() @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsString()
  occupation?: string;

  @IsOptional() @IsBoolean()
  isWorker?: boolean;
}