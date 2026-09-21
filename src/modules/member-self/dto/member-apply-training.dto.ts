// member-self/dto/member-apply-training.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class MemberApplyTrainingDto {
  @IsNotEmpty()
  @IsUUID('4')
  departmentId!: string;

  @IsOptional() @IsString() @Length(1, 1000)
  notes?: string;
}