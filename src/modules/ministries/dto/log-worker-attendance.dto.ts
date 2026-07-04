import { IsDateString, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { AttendanceStatus } from '../../../../app/generated/prisma/client';

export class LogWorkerAttendanceDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Worker ID reference must be a valid UUID.' })
  workerId!: string;

  @IsNotEmpty()
  @IsDateString({}, { message: 'Target assignment date must be a valid ISO 8601 string.' })
  date!: string;

  @IsNotEmpty()
  @IsEnum(AttendanceStatus, { message: 'Invalid worker status value mapped.' })
  status!: AttendanceStatus;
}