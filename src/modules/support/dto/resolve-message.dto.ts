import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class ResolveMessageDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Assignee reference must be a valid UUID mapping to an active administrator.' })
  assignedToId!: string;

  @IsNotEmpty()
  @IsBoolean()
  isResolved!: boolean;
}