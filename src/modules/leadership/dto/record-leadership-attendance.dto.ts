// dto/record-leadership-attendance.dto.ts
import { IsString, IsEnum } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class RecordLeadershipAttendanceDto {
  @IsString()
  memberId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}