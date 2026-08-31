export interface TrendPoint {
  date: string;
  count: number;
}

export interface AdminDashboardSummary {
  generatedAt: Date;
  users: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    admins: number;
    members: number;
    registeredLast7Days: number;
    registeredLast30Days: number;
    recentlyActive: number;
  };
  attendance: {
    checkInsToday: number;
    uniqueUsersToday: number;
    participantsThisMonth: number;
  };
  finance: {
    transactionCountThisMonth: number;
    totalIncomeThisMonth: string;
    totalExpenseThisMonth: string;
    activeUsersThisMonth: number;
    usersWithOverallBudget: number;
    usersOverOverallBudget: number;
    currency: 'VND';
  };
  gold: {
    latestSnapshotAt: Date | null;
    provider: string | null;
    activeAlerts: number;
    usersWithActiveAlerts: number;
    triggersLast24Hours: number;
    triggersLast7Days: number;
  };
  notifications: {
    createdLast24Hours: number;
    createdLast7Days: number;
    sentLast7Days: number;
    partialLast7Days: number;
    failedLast7Days: number;
    activeDevices: number;
    inactiveDevices: number;
  };
}

export interface AdminDashboardTrends {
  windowDays: 7;
  startDate: string;
  endDate: string;
  registrations: TrendPoint[];
  attendance: TrendPoint[];
  goldAlertTriggers: TrendPoint[];
  notifications: TrendPoint[];
  recentActivity: {
    registrations: Array<{
      displayName: string;
      createdAt: Date;
    }>;
    attendance: Array<{
      displayName: string;
      checkedInAt: Date;
    }>;
    goldAlertTriggers: Array<{
      productCode: string;
      triggeredAt: Date;
    }>;
  };
}
