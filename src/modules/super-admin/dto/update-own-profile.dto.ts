import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOwnProfileDto {
  @ApiPropertyOptional({
    description: 'Full name of the administrator',
    example: 'Ikujebi Kehinde',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters long.' })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Email address of the administrator',
    example: 'admin@wordtabernacle.org.ng',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email?: string;
}