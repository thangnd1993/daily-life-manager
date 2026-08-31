import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { AdminUsersService } from './admin-users.service';
import {
  ListUsersQueryDto,
  SortDirection,
  UserSortField,
} from './dto/admin-users.dto';

const now = new Date('2026-08-29T00:00:00.000Z');
const safeUser = {
  id: 'user-1',
  email: 'user@example.com',
  displayName: 'User One',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: now,
  updatedAt: now,
};
const admin: AuthenticatedUser = {
  ...safeUser,
  id: 'admin-1',
  role: UserRole.ADMIN,
  sessionId: 'session-1',
};

describe('AdminUsersService', () => {
  const transaction = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    authSession: { updateMany: jest.fn() },
  };
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: AdminUsersService;
  const audit = { record: jest.fn().mockResolvedValue({}) };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminUsersService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  it('lists users with pagination, search, filters, and allowlisted sorting', async () => {
    prisma.user.findMany.mockReturnValue('items-query');
    prisma.user.count.mockReturnValue('count-query');
    prisma.$transaction.mockResolvedValue([[safeUser], 21]);
    const query = Object.assign(new ListUsersQueryDto(), {
      page: 2,
      pageSize: 10,
      search: 'user',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      sortBy: UserSortField.EMAIL,
      sortDirection: SortDirection.ASC,
    });

    await expect(service.list(query)).resolves.toEqual({
      items: [safeUser],
      page: 2,
      pageSize: 10,
      totalItems: 21,
      totalPages: 3,
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ email: 'asc' }, { id: 'asc' }],
        where: expect.objectContaining({
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        }),
      }),
    );
  });

  it('returns detail without sensitive fields and includes active session count', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...safeUser,
      _count: { authSessions: 2 },
    });
    const result = await service.detail('user-1');
    expect(result).toEqual({ ...safeUser, activeSessionCount: 2 });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('authSessions');
  });

  it('handles a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.detail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([UserStatus.INACTIVE, UserStatus.SUSPENDED])(
    'rejects self-disable with %s',
    async (status) => {
      await expect(
        service.updateStatus(admin, admin.id, status),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('updates status and revokes sessions when disabling a user', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      },
    );
    transaction.user.findUnique.mockResolvedValue(safeUser);
    prisma.user.findUnique.mockResolvedValue({
      ...safeUser,
      status: UserStatus.SUSPENDED,
      _count: { authSessions: 0 },
    });

    await service.updateStatus(admin, safeUser.id, UserStatus.SUSPENDED);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_USER_STATUS_CHANGED',
        metadata: {
          previousStatus: UserStatus.ACTIVE,
          newStatus: UserStatus.SUSPENDED,
        },
      }),
      transaction,
    );
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: safeUser.id },
      data: { status: UserStatus.SUSPENDED },
    });
    expect(transaction.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: safeUser.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('prevents disabling the final active administrator', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      },
    );
    transaction.user.findUnique.mockResolvedValue({
      ...safeUser,
      role: UserRole.ADMIN,
    });
    transaction.user.count.mockResolvedValue(1);
    await expect(
      service.updateStatus(admin, safeUser.id, UserStatus.INACTIVE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
