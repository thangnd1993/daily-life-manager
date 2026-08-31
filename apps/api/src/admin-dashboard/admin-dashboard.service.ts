import { Injectable } from '@nestjs/common';
import {
  FinanceTransactionType,
  NotificationStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  AdminDashboardSummary,
  AdminDashboardTrends,
  TrendPoint,
} from './admin-dashboard.types';

const DAY_MS = 86_400_000;

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<AdminDashboardSummary> {
    const now = new Date();
    const today = this.startOfUtcDay(now);
    const tomorrow = new Date(today.getTime() + DAY_MS);
    const sevenDaysAgo = new Date(today.getTime() - 6 * DAY_MS);
    const thirtyDaysAgo = new Date(today.getTime() - 29 * DAY_MS);
    const last24Hours = new Date(now.getTime() - DAY_MS);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const currentMonth = { gte: monthStart, lt: monthEnd };

    const [
      totalUsers,
      userStatuses,
      userRoles,
      registeredLast7Days,
      registeredLast30Days,
      recentlyActive,
      checkInsToday,
      attendanceUsers,
      financeCount,
      financeTotals,
      financeUsers,
      overallBudgets,
      expenseByUser,
      latestGoldSnapshot,
      activeAlerts,
      activeAlertUsers,
      triggersLast24Hours,
      triggersLast7Days,
      notificationsLast24Hours,
      notificationsLast7Days,
      notificationStatuses,
      activeDevices,
      inactiveDevices,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo, lt: tomorrow } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo, lt: tomorrow } },
      }),
      this.prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo, lt: tomorrow } },
      }),
      this.prisma.attendance.count({
        where: { attendanceDate: { gte: today, lt: tomorrow } },
      }),
      this.prisma.attendance.groupBy({
        by: ['userId'],
        where: { attendanceDate: currentMonth },
      }),
      this.prisma.financeTransaction.count({
        where: { occurredAt: currentMonth },
      }),
      this.prisma.financeTransaction.groupBy({
        by: ['type'],
        where: { occurredAt: currentMonth },
        _sum: { amount: true },
      }),
      this.prisma.financeTransaction.groupBy({
        by: ['userId'],
        where: { occurredAt: currentMonth },
      }),
      this.prisma.financeBudget.findMany({
        where: {
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
          categoryId: null,
        },
        select: { userId: true, amount: true },
      }),
      this.prisma.financeTransaction.groupBy({
        by: ['userId'],
        where: {
          type: FinanceTransactionType.EXPENSE,
          occurredAt: currentMonth,
        },
        _sum: { amount: true },
      }),
      this.prisma.goldPriceSnapshot.findFirst({
        orderBy: [{ sourceTimestamp: 'desc' }, { id: 'asc' }],
        select: { sourceTimestamp: true, provider: true },
      }),
      this.prisma.goldAlert.count({ where: { isEnabled: true } }),
      this.prisma.goldAlert.groupBy({
        by: ['userId'],
        where: { isEnabled: true },
      }),
      this.prisma.goldAlertTrigger.count({
        where: { triggeredAt: { gte: last24Hours, lte: now } },
      }),
      this.prisma.goldAlertTrigger.count({
        where: { triggeredAt: { gte: sevenDaysAgo, lt: tomorrow } },
      }),
      this.prisma.notification.count({
        where: { createdAt: { gte: last24Hours, lte: now } },
      }),
      this.prisma.notification.count({
        where: { createdAt: { gte: sevenDaysAgo, lt: tomorrow } },
      }),
      this.prisma.notification.groupBy({
        by: ['status'],
        where: { createdAt: { gte: sevenDaysAgo, lt: tomorrow } },
        _count: { _all: true },
      }),
      this.prisma.pushDevice.count({ where: { isActive: true } }),
      this.prisma.pushDevice.count({ where: { isActive: false } }),
    ]);

    const userStatusCount = (status: UserStatus) =>
      userStatuses.find((item) => item.status === status)?._count._all ?? 0;
    const userRoleCount = (role: UserRole) =>
      userRoles.find((item) => item.role === role)?._count._all ?? 0;
    const financeTotal = (type: FinanceTransactionType) =>
      financeTotals.find((item) => item.type === type)?._sum.amount ?? 0n;
    const notificationCount = (status: NotificationStatus) =>
      notificationStatuses.find((item) => item.status === status)?._count
        ._all ?? 0;
    const expenseMap = new Map(
      expenseByUser.map((item) => [item.userId, item._sum.amount ?? 0n]),
    );

    return {
      generatedAt: now,
      users: {
        total: totalUsers,
        active: userStatusCount(UserStatus.ACTIVE),
        inactive: userStatusCount(UserStatus.INACTIVE),
        suspended: userStatusCount(UserStatus.SUSPENDED),
        admins: userRoleCount(UserRole.ADMIN),
        members: userRoleCount(UserRole.USER),
        registeredLast7Days,
        registeredLast30Days,
        recentlyActive,
      },
      attendance: {
        checkInsToday,
        uniqueUsersToday: checkInsToday,
        participantsThisMonth: attendanceUsers.length,
      },
      finance: {
        transactionCountThisMonth: financeCount,
        totalIncomeThisMonth: financeTotal(
          FinanceTransactionType.INCOME,
        ).toString(),
        totalExpenseThisMonth: financeTotal(
          FinanceTransactionType.EXPENSE,
        ).toString(),
        activeUsersThisMonth: financeUsers.length,
        usersWithOverallBudget: overallBudgets.length,
        usersOverOverallBudget: overallBudgets.filter(
          (budget) => (expenseMap.get(budget.userId) ?? 0n) > budget.amount,
        ).length,
        currency: 'VND',
      },
      gold: {
        latestSnapshotAt: latestGoldSnapshot?.sourceTimestamp ?? null,
        provider: latestGoldSnapshot?.provider ?? null,
        activeAlerts,
        usersWithActiveAlerts: activeAlertUsers.length,
        triggersLast24Hours,
        triggersLast7Days,
      },
      notifications: {
        createdLast24Hours: notificationsLast24Hours,
        createdLast7Days: notificationsLast7Days,
        sentLast7Days: notificationCount(NotificationStatus.SENT),
        partialLast7Days: notificationCount(NotificationStatus.PARTIAL),
        failedLast7Days: notificationCount(NotificationStatus.FAILED),
        activeDevices,
        inactiveDevices,
      },
    };
  }

  async trends(): Promise<AdminDashboardTrends> {
    const now = new Date();
    const end = new Date(this.startOfUtcDay(now).getTime() + DAY_MS);
    const start = new Date(end.getTime() - 7 * DAY_MS);
    const window = { gte: start, lt: end };
    const [
      registrations,
      attendance,
      triggers,
      notifications,
      recentRegistrations,
      recentAttendance,
      recentTriggers,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: window },
        select: { createdAt: true },
      }),
      this.prisma.attendance.findMany({
        where: { attendanceDate: window },
        select: { attendanceDate: true },
      }),
      this.prisma.goldAlertTrigger.findMany({
        where: { triggeredAt: window },
        select: { triggeredAt: true },
      }),
      this.prisma.notification.findMany({
        where: { createdAt: window },
        select: { createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: window },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 5,
        select: { displayName: true, createdAt: true },
      }),
      this.prisma.attendance.findMany({
        where: { checkedInAt: window },
        orderBy: [{ checkedInAt: 'desc' }, { id: 'asc' }],
        take: 5,
        select: { checkedInAt: true, user: { select: { displayName: true } } },
      }),
      this.prisma.goldAlertTrigger.findMany({
        where: { triggeredAt: window },
        orderBy: [{ triggeredAt: 'desc' }, { id: 'asc' }],
        take: 5,
        select: { productCode: true, triggeredAt: true },
      }),
    ]);

    return {
      windowDays: 7,
      startDate: this.dateKey(start),
      endDate: this.dateKey(new Date(end.getTime() - DAY_MS)),
      registrations: this.toTrend(
        start,
        registrations.map((item) => item.createdAt),
      ),
      attendance: this.toTrend(
        start,
        attendance.map((item) => item.attendanceDate),
      ),
      goldAlertTriggers: this.toTrend(
        start,
        triggers.map((item) => item.triggeredAt),
      ),
      notifications: this.toTrend(
        start,
        notifications.map((item) => item.createdAt),
      ),
      recentActivity: {
        registrations: recentRegistrations,
        attendance: recentAttendance.map((item) => ({
          displayName: item.user.displayName,
          checkedInAt: item.checkedInAt,
        })),
        goldAlertTriggers: recentTriggers,
      },
    };
  }

  private toTrend(start: Date, dates: Date[]): TrendPoint[] {
    const counts = new Map<string, number>();
    dates.forEach((date) =>
      counts.set(this.dateKey(date), (counts.get(this.dateKey(date)) ?? 0) + 1),
    );
    return Array.from({ length: 7 }, (_, index) => {
      const date = this.dateKey(new Date(start.getTime() + index * DAY_MS));
      return { date, count: counts.get(date) ?? 0 };
    });
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
