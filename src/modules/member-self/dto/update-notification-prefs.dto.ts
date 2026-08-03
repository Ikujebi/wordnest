import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @IsOptional() @IsBoolean() receiveEmailNotifications?: boolean;
  @IsOptional() @IsBoolean() receiveSmsNotifications?: boolean;
}