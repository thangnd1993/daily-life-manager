import { UserRole, UserStatus } from '../../core/auth/auth.models';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail extends AdminUser {
  activeSessionCount: number;
}

export interface UsersPage {
  items: AdminUser[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface UsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy: 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'email' | 'displayName';
  sortDirection: 'asc' | 'desc';
}

export interface AttendancePage {
  items: Array<{
    id: string;
    attendanceDate: string;
    checkedInAt: string;
    timezone: string;
    source: string;
    note: string | null;
  }>;
  checkedInDays: number;
  year: number;
  month: number;
}

export interface FinancePage {
  items: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE';
    amount: string;
    currency: 'VND';
    description: string | null;
    occurredAt: string;
    category: { id: string; name: string };
  }>;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: {
    totalIncome: string;
    totalExpense: string;
    netBalance: string;
    currency: 'VND';
  };
}

export interface FinanceInsights {
  budgets: Array<{
    id: string;
    categoryId: string | null;
    category: { id: string; name: string } | null;
    amount: string;
    spentAmount: string;
    remainingAmount: string;
    percentageUsed: number;
    exceeded: boolean;
  }>;
  analytics: {
    expenseByCategory: Array<{
      category: { id: string; name: string };
      amount: string;
      percentage: number;
    }>;
    trend: Array<{
      year: number;
      month: number;
      totalIncome: string;
      totalExpense: string;
      netBalance: string;
    }>;
  };
}
