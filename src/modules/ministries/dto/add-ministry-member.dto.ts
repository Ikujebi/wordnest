import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AddMinistryMemberDto {
  @IsString()
  @IsNotEmpty()
  memberId!: string;

  @IsOptional()
  @IsString()
  roleTitle?: string; // e.g. "Youth Pastor" — defaults to "Member" if omitted

  @IsOptional()
  @IsBoolean()
  isLeader?: boolean;
}