import {
  FinanceTransactionType,
  NotificationStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  const prisma = {
    user: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    attendance: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    financeTransaction: { count: jest.fn(), groupBy: jest.fn() },
    financeBudget: { findMany: jest.fn() },
    goldPriceSnapshot: { findFirst: jest.fn() },
    goldAlert: { count: jest.fn(), groupBy: jest.fn() },
    goldAlertTrigger: { count: jest.fn(), findMany: jest.fn() },
    notification: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    pushDevice: { count: jest.fn() },
  };
  let service: AdminDashboardService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T10:00:00.000Z'));
    jest.resetAllMocks();
    service = new AdminDashboardService(prisma as unknown as PrismaService);
    prisma.user.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(6);
    prisma.user.groupBy
      .mockResolvedValueOnce([
        { status: UserStatus.ACTIVE, _count: { _all: 7 } },
        { status: UserStatus.INACTIVE, _count: { _all: 2 } },
        { status: UserStatus.SUSPENDED, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { role: UserRole.ADMIN, _count: { _all: 1 } },
        { role: UserRole.USER, _count: { _all: 9 } },
      ]);
    prisma.attendance.count.mockResolvedValue(3);
    prisma.attendance.groupBy.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    prisma.financeTransaction.count.mockResolvedValue(5);
    prisma.financeTransaction.groupBy
      .mockResolvedValueOnce([
        { type: FinanceTransactionType.INCOME, _sum: { amount: 5_000_000n } },
        { type: FinanceTransactionType.EXPENSE, _sum: { amount: 3_500_000n } },
      ])
      .mockResolvedValueOnce([{ userId: 'user-1' }, { userId: 'user-2' }])
      .mockResolvedValueOnce([
        { userId: 'user-1', _sum: { amount: 2_500_000n } },
        { userId: 'user-2', _sum: { amount: 1_000_000n } },
      ]);
    prisma.financeBudget.findMany.mockResolvedValue([
      { userId: 'user-1', amount: 2_000_000n },
      { userId: 'user-2', amount: 1_500_000n },
    ]);
    prisma.goldPriceSnapshot.findFirst.mockResolvedValue({
      provider: 'SJC',
      sourceTimestamp: new Date('2026-08-31T09:00:00.000Z'),
    });
    prisma.goldAlert.count.mockResolvedValue(4);
    prisma.goldAlert.groupBy.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    prisma.goldAlertTrigger.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    prisma.notification.count.mockResolvedValueOnce(2).mockResolvedValueOnce(8);
    prisma.notification.groupBy.mockResolvedValue([
      { status: NotificationStatus.SENT, _count: { _all: 5 } },
      { status: NotificationStatus.PARTIAL, _count: { _all: 2 } },
      { status: NotificationStatus.FAILED, _count: { _all: 1 } },
    ]);
    prisma.pushDevice.count.mockResolvedValueOnce(6).mockResolvedValueOnce(2);
  });

  afterEach(() => jest.useRealTimers());

  it('returns bounded account, attendance, finance, budget, gold, and notification aggregates', async () => {
    const result = await service.summary();

    expect(result.users).toEqual({
      total: 10,
      active: 7,
      inactive: 2,
      suspended: 1,
      admins: 1,
      members: 9,
      registeredLast7Days: 2,
      registeredLast30Days: 4,
      recentlyActive: 6,
    });
    expect(result.attendance).toEqual({
      checkInsToday: 3,
      uniqueUsersToday: 3,
      participantsThisMonth: 2,
    });
    expect(result.finance).toEqual({
      transactionCountThisMonth: 5,
      totalIncomeThisMonth: '5000000',
      totalExpenseThisMonth: '3500000',
      activeUsersThisMonth: 2,
      usersWithOverallBudget: 2,
      usersOverOverallBudget: 1,
      currency: 'VND',
    });
    expect(result.gold).toEqual(
      expect.objectContaining({ activeAlerts: 4, triggersLast24Hours: 1 }),
    );
    expect(result.notifications).toEqual(
      expect.objectContaining({
        sentLast7Days: 5,
        partialLast7Days: 2,
        failedLast7Days: 1,
        activeDevices: 6,
      }),
    );
    expect(prisma.financeTransaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ occurredAt: expect.any(Object) }),
      }),
    );
  });

  it('returns stable zero and null values for an empty dataset', async () => {
    jest.resetAllMocks();
    prisma.user.count.mockResolvedValue(0);
    prisma.user.groupBy.mockResolvedValue([]);
    prisma.attendance.count.mockResolvedValue(0);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.financeTransaction.count.mockResolvedValue(0);
    prisma.financeTransaction.groupBy.mockResolvedValue([]);
    prisma.financeBudget.findMany.mockResolvedValue([]);
    prisma.goldPriceSnapshot.findFirst.mockResolvedValue(null);
    prisma.goldAlert.count.mockResolvedValue(0);
    prisma.goldAlert.groupBy.mockResolvedValue([]);
    prisma.goldAlertTrigger.count.mockResolvedValue(0);
    prisma.notification.count.mockResolvedValue(0);
    prisma.notification.groupBy.mockResolvedValue([]);
    prisma.pushDevice.count.mockResolvedValue(0);

    const result = await service.summary();
    expect(result.users.total).toBe(0);
    expect(result.finance.totalExpenseThisMonth).toBe('0');
    expect(result.gold.latestSnapshotAt).toBeNull();
    expect(result.notifications.failedLast7Days).toBe(0);
    expect(JSON.stringify(result)).not.toContain('description');
    expect(JSON.stringify(result)).not.toContain('pushToken');
  });

  it('orders seven fixed daily trend buckets and returns only safe recent activity fields', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-08-25T08:00:00Z') },
        { createdAt: new Date('2026-08-31T08:00:00Z') },
      ])
      .mockResolvedValueOnce([
        { displayName: 'Alex', createdAt: new Date('2026-08-31T08:00:00Z') },
      ]);
    prisma.attendance.findMany
      .mockResolvedValueOnce([
        { attendanceDate: new Date('2026-08-26T00:00:00Z') },
      ])
      .mockResolvedValueOnce([
        {
          checkedInAt: new Date('2026-08-31T07:00:00Z'),
          user: { displayName: 'Blair' },
        },
      ]);
    prisma.goldAlertTrigger.findMany
      .mockResolvedValueOnce([
        { triggeredAt: new Date('2026-08-31T06:00:00Z') },
      ])
      .mockResolvedValueOnce([
        { productCode: 'SJC', triggeredAt: new Date('2026-08-31T06:00:00Z') },
      ]);
    prisma.notification.findMany.mockResolvedValue([
      { createdAt: new Date('2026-08-30T05:00:00Z') },
    ]);

    const result = await service.trends();
    expect(result.startDate).toBe('2026-08-25');
    expect(result.endDate).toBe('2026-08-31');
    expect(result.registrations).toHaveLength(7);
    expect(result.registrations.map((point) => point.date)).toEqual([
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
    ]);
    expect(result.registrations.map((point) => point.count)).toEqual([
      1, 0, 0, 0, 0, 0, 1,
    ]);
    expect(result.recentActivity.attendance[0]).toEqual({
      displayName: 'Blair',
      checkedInAt: new Date('2026-08-31T07:00:00Z'),
    });
    expect(JSON.stringify(result)).not.toContain('email');
    expect(JSON.stringify(result)).not.toContain('description');
  });
});
