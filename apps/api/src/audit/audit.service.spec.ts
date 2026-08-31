import { AuditOutcome, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

describe('AuditService', () => {
  const prisma = {
    auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('bounds metadata and removes secret-shaped fields', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    await service.record({
      actorUserId: 'admin-1',
      actorRole: UserRole.ADMIN,
      action: 'ADMIN_USER_STATUS_CHANGED',
      targetType: 'USER',
      targetId: 'user-1',
      metadata: {
        previousStatus: 'ACTIVE',
        newStatus: 'SUSPENDED',
        refreshToken: 'must-not-be-stored',
        password: 'must-not-be-stored',
      },
      context: { ipAddress: '127.0.0.1', userAgent: 'x'.repeat(500) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: AuditOutcome.SUCCESS,
        metadata: { previousStatus: 'ACTIVE', newStatus: 'SUSPENDED' },
        userAgent: 'x'.repeat(256),
      }),
    });
  });

  it('paginates and applies allowlisted filters with deterministic ordering', async () => {
    prisma.auditLog.findMany.mockReturnValue('items-query');
    prisma.auditLog.count.mockReturnValue('count-query');
    prisma.$transaction.mockResolvedValue([[{ id: 'audit-1' }], 26]);
    const query = Object.assign(new AuditLogQueryDto(), {
      page: 2,
      pageSize: 25,
      action: 'PASSWORD_CHANGED',
      actorUserId: 'user-1',
      targetType: 'USER',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T23:59:59.000Z',
    });
    await expect(service.list(query)).resolves.toEqual({
      items: [{ id: 'audit-1' }],
      page: 2,
      pageSize: 25,
      totalItems: 26,
      totalPages: 2,
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        where: expect.objectContaining({
          action: 'PASSWORD_CHANGED',
          actorUserId: 'user-1',
        }),
      }),
    );
  });

  it('rejects an inverted date range', async () => {
    const query = Object.assign(new AuditLogQueryDto(), {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-08-01T00:00:00.000Z',
    });
    await expect(service.list(query)).rejects.toThrow(
      'from must not be after to',
    );
  });
});
