import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
// 🔥 Import all communication enums straight from the auto-generated Prisma Client
import { CommunicationStatus, CommunicationType } from '@prisma/client'; 

export class CommunicationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer number.' })
  @Min(1, { message: 'Page number must be at least 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer number.' })
  @Min(1, { message: 'Limit must be at least 1.' })
  @Max(100, { message: 'Maximum limit per page is 100.' })
  limit?: number = 20;

  @IsOptional()
  @IsEnum(CommunicationStatus, {
    message: `Status must be a valid enum value: ${Object.values(CommunicationStatus).join(', ')}`,
  })
  status?: CommunicationStatus;

  @IsOptional()
  @IsEnum(CommunicationType, {
    message: `Type must be a valid enum value: ${Object.values(CommunicationType).join(', ')}`,
  })
  type?: CommunicationType; // 🔥 Changed from string to explicit CommunicationType enum

  @IsOptional()
  @IsString({ message: 'Search term must be a valid string.' })
  search?: string;
}