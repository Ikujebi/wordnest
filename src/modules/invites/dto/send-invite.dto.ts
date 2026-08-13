// dto/send-invite.dto.ts
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { InviteRole } from '@prisma/client';

export class SendInviteDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid recipient email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsNotEmpty()
  @IsEnum(InviteRole, { message: 'Role must be one of MEMBER, ADMIN, or SUPER_ADMIN.' })
  role!: InviteRole;
}