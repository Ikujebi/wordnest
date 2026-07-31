import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateMinistryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}