import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CommunicationStatus } from '../enums/communication-status.enum';

// If you have a CommunicationType enum, import it here. 
// Otherwise, we can validate it as a standard string.
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
  @IsString({ message: 'Type filter must be a valid string.' })
  type?: string;

  @IsOptional()
  @IsString({ message: 'Search term must be a valid string.' })
  search?: string;
}