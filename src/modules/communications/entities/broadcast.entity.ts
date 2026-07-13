import { Type, Exclude } from 'class-transformer';
import { 
  CommunicationStatus, 
  CommunicationChannel, 
  CommunicationType,
  RecipientStatus
} from '@prisma/client';

export class CommunicationRecipientEntity {
  id: string;
  communicationId: string;
  memberId: string | null;
  email: string | null;
  phone: string | null;
  status: RecipientStatus; // Changed to match your prisma enum

  @Type(() => Date)
  sentAt: Date | null;    // Added to match schema.prisma
}

export class CommunicationLogEntity {
  id: string;
  communicationId: string;
  channel: CommunicationChannel; // Strictly typed to your prisma enum
  success: boolean;              // Changed from status/error to match your schema.prisma exactly
  response: string | null;       // Changed to match your schema.prisma exactly

  @Type(() => Date)
  createdAt: Date;
}

export class BroadcastEntity {
  id: string;
  title: string;
  subject: string | null; // Can be null according to your prisma schema
  content: string;
  type: CommunicationType; // Strictly typed to your prisma enum
  status: CommunicationStatus;
  channels: CommunicationChannel[]; // Strictly typed array matching your schema
  createdById: string;
  metadata: any;

  @Type(() => Date)
  scheduledAt: Date | null;

  @Type(() => Date)
  sentAt: Date | null; // Added to match schema.prisma

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