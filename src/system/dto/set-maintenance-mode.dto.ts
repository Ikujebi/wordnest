import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetMaintenanceModeDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}