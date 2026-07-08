import { Exclude, Type } from 'class-transformer';

export class CommunicationLogEntity {
  id: string;
  communicationId: string;
  
  // E.g., 'EMAIL', 'SMS', 'PUSH'
  channel: string;
  
  // E.g., 'PENDING', 'DELIVERED', 'FAILED'
  status: string;

  // Stores failure reasons or provider message IDs (nullable)
  error: string | null;

  @Type(() => Date)
  createdAt: Date;

  // If you trace updates to log lifecycles
  @Type(() => Date)
  updatedAt: Date;

  constructor(partial: Partial<CommunicationLogEntity>) {
    Object.assign(this, partial);
  }
}