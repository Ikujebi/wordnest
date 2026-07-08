import { Exclude, Type } from 'class-transformer';
import { CommunicationStatus } from '../enums/communication-status.enum';

// Replace these inline interfaces with your actual imported entities if available
export class CommunicationRecipientEntity {
  id: string;
  communicationId: string;
  memberId?: string | null;
  email?: string | null;
  phone?: string | null;
  createdAt: Date;
}

export class CommunicationLogEntity {
  id: string;
  communicationId: string;
  channel: string;
  status: string;
  error?: string | null;
  createdAt: Date;
}

export class BroadcastEntity {
  id: string;
  title: string;
  subject: string;
  content: string;
  type: string;
  status: CommunicationStatus;
  channels: string[];
  createdById: string;

  @Type(() => Date)
  scheduledAt: Date | null;

  @Type(() => Date)
  createdAt: Date;

  @Type(() => Date)
  updatedAt: Date;

  @Exclude()
  deletedAt: Date | null;

  @Exclude()
  archivedAt: Date | null;

  // Nested Relations
  @Type(() => CommunicationRecipientEntity)
  recipients?: CommunicationRecipientEntity[];

  @Type(() => CommunicationLogEntity)
  logs?: CommunicationLogEntity[];

  constructor(partial: Partial<BroadcastEntity>) {
    Object.assign(this, partial);
  }
}