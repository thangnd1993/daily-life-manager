import { UserRole, UserStatus } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  sessionId: string;
}

export interface SafeUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}
