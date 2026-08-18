import { IsOptional, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class PendingInvitesQueryDto {
  /**
   * Accepts a single role or comma-separated list, e.g. "MEMBER" or
   * "ADMIN,SUPER_ADMIN" — lets the admins page ask for admin-tier invites
   * only, and the members page ask for member invites only.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((v) => v.trim()) : value))
  @IsIn(['MEMBER', 'ADMIN', 'SUPER_ADMIN'], { each: true })
  roles?: ('MEMBER' | 'ADMIN' | 'SUPER_ADMIN')[];
}