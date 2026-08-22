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
    | 'ALL_SUBSCRIBERS'
    | 'ALL_MEMBERS_AND_SUBSCRIBERS'
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

  // createdById intentionally removed — it's never client-supplied. The
  // controller derives it from the authenticated JWT (req.user.id) and
  // passes it to the service as a separate argument, not part of the
  // validated body. See CommunicationsController.create /
  // CommunicationsService.create.

  /**
   * Recipient targeting rules
   */
  @IsOptional()
  @ValidateNested()
  @Type(
    () => RecipientFilterDto,
  )
  recipients?: RecipientFilterDto;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
