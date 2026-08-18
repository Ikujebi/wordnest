import { IsOptional, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class UnverifiedUsersQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((v) => v.trim()) : value))
  @IsIn(['MEMBER', 'ADMIN', 'SUPER_ADMIN'], { each: true })
  roles?: ('MEMBER' | 'ADMIN' | 'SUPER_ADMIN')[];
}