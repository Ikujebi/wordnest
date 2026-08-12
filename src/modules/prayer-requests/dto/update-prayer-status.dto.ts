import { IsEnum } from 'class-validator';
import { PrayerRequestStatus } from '@prisma/client';

export class UpdatePrayerStatusDto {
  @IsEnum(PrayerRequestStatus)
  status!: PrayerRequestStatus;
}