import { AuditAction } from '../enums/audit-action.enum';

export interface AuditMetadata {
  action: AuditAction;

  entity?: string;

  description?: string;

  entityId?: string;

  oldValues?: Record<string, any>;

  newValues?: Record<string, any>;

  metadata?: Record<string, any>;
}