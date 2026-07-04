import { IsNotEmpty, IsUUID } from 'class-validator';

export class EnrollMemberDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Member ID reference must be a valid UUID.' })
  memberId!: string;
}