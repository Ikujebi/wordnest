import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateMemberProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() occupation?: string;
}