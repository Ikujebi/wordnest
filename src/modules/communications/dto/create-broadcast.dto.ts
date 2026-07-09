import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

// 🔥 Unified enums directly from the auto-generated Prisma client
import { CommunicationType, CommunicationChannel } from '@prisma/client'; 

class RecipientFilterDto {
  @IsString()
  @IsNotEmpty()
  type!:
    | 'ALL_MEMBERS'
    | 'WORKERS'
    | 'DEPARTMENT'
    | 'MINISTRY'
    | 'INDIVIDUAL'
    | 'CUSTOM';

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  ministryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({
    each: true,
  })
  memberIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({
    each: true,
  })
  emails?: string[];
}

export class CreateBroadcastDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsEnum(CommunicationType)
  type!: CommunicationType;

  @IsArray()
  @IsEnum(
    CommunicationChannel,
    {
      each: true,
    },
  )
  channels!: CommunicationChannel[];

  @IsOptional()
  @IsDateString()
  scheduledAt?: Date;

  /**
   * User creating the communication
   */
  @IsString()
  @IsNotEmpty()
  createdById!: string;

  /**
   * Recipient targeting rules
   */
  @IsOptional()
  @ValidateNested()
  @Type(
    () => RecipientFilterDto,
  )
  recipients?: RecipientFilterDto;
}