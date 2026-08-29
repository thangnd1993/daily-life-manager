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
