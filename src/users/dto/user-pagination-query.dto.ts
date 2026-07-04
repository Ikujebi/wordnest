import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../app/generated/prisma/client';
import { USER_LIMITS } from '../users.constants';

export class UserPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'The page number to retrieve',
    minimum: 1,
    default: USER_LIMITS.PAGINATION.DEFAULT_PAGE,
  })
  @IsOptional()
  @Type(() => Number) // Converts incoming string query parameter to a Number
  @IsInt()
  @Min(1)
  page: number = USER_LIMITS.PAGINATION.DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    minimum: 1,
    maximum: USER_LIMITS.PAGINATION.MAX_LIMIT,
    default: USER_LIMITS.PAGINATION.DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(USER_LIMITS.PAGINATION.MAX_LIMIT)
  limit: number = USER_LIMITS.PAGINATION.DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Search phrase to filter users by fullName or email',
    example: 'Jane',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim()) // Sanitizes input by removing accidental leading/trailing spaces
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter users by their system role',
    enum: Role,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Filter users by active account status',
  })
  @IsOptional()
  @Type(() => Boolean) // Converts query strings like "true" or "false" to a real boolean
  @IsBoolean()
  isActive?: boolean;
}