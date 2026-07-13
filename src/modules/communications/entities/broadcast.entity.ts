import { Type, Exclude } from 'class-transformer';

import {
  CommunicationStatus,
  CommunicationChannel,
  CommunicationType,
  RecipientStatus,
} from '@prisma/client';


export class CommunicationRecipientEntity {
  id!: string;

  communicationId!: string;

  memberId!: string | null;

  email!: string | null;

  phone!: string | null;

  status!: RecipientStatus;

  @Type(() => Date)
  sentAt!: Date | null;
}


export class CommunicationLogEntity {
  id!: string;

  communicationId!: string;

  channel!: CommunicationChannel;

  success!: boolean;

  response!: string | null;

  @Type(() => Date)
  createdAt!: Date;
}


export class BroadcastEntity {
  id!: string;

  title!: string;

  subject!: string | null;

  content!: string;

  type!: CommunicationType;

  status!: CommunicationStatus;

  channels!: CommunicationChannel[];

  createdById!: string;

  metadata!: any;

  @Type(() => Date)
  scheduledAt!: Date | null;

  @Type(() => Date)
  sentAt!: Date | null;

  @Type(() => Date)
  createdAt!: Date;

  @Type(() => Date)
  updatedAt!: Date;

  @Exclude()
  deletedAt!: Date | null;

  @Exclude()
  archivedAt!: Date | null;


  // Nested Relations

  @Type(() => CommunicationRecipientEntity)
  recipients?: CommunicationRecipientEntity[];


  @Type(() => CommunicationLogEntity)
  logs?: CommunicationLogEntity[];


  constructor(partial: Partial<BroadcastEntity>) {
    Object.assign(this, partial);
  }
}