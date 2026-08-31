export interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  actorRole: 'ADMIN' | 'USER' | null;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: 'SUCCESS' | 'FAILURE';
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: { displayName: string; email: string } | null;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  action?: string;
  targetType?: string;
}
