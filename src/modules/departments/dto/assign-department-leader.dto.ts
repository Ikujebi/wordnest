// src/departments/dto/assign-department-leader.dto.ts
import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignDepartmentLeaderDto {
  @IsNotEmpty()
  @IsUUID()
  leaderId!: string; // The Member ID to designate as leader
}