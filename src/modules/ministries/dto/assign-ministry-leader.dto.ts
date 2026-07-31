import { IsString, IsNotEmpty } from 'class-validator';

export class AssignMinistryLeaderDto {
  @IsString()
  @IsNotEmpty()
  leaderId!: string; // Member.id — must already be an active roster member
}