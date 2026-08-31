import { AuditOutcome, UserRole } from '@prisma/client';
import { Request } from 'express';

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditEvent {
  actorUserId?: string;
  actorRole?: UserRole;
  action: string;
  targetType: string;
  targetId?: string;
  outcome?: AuditOutcome;
  metadata?: Record<string, unknown>;
  context?: AuditContext;
}

export function auditContext(request: Request): AuditContext {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  };
}
