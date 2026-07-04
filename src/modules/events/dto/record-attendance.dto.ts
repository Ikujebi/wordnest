import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class RecordAttendanceDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Member ID must be a valid UUID.' })
  memberId!: string;

  @IsNotEmpty()
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}