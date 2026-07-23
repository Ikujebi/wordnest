import { SetMetadata } from '@nestjs/common';
import { AuditMetadata } from '../interfaces/audit.interface';

export const AUDIT_KEY = 'audit';

export const Audit = (
  metadata: AuditMetadata,
) => SetMetadata(AUDIT_KEY, metadata);