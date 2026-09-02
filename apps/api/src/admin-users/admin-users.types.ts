import { UserRole, UserStatus } from '@prisma/client';

export interface AdminUserItem {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attendanceEnabled: boolean;
  leaveModeEnabled: boolean;
  attendanceTimezone: string;
  defaultDailyWorkMinutes: number;
}

export interface AdminUserDetail extends AdminUserItem {
  activeSessionCount: number;
}

export interface PaginatedUsers {
  items: AdminUserItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
