import { IsEnum, IsDateString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class RecordAttendanceDto {
  @IsDateString()
  date!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}