import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { JwtStrategy } from './jwt.strategy';
import {
  PasswordResetDeliveryService,
  PasswordResetMessage,
} from './password-reset-delivery.service';

const strongPassword = 'Strong!Password123';
const nextPassword = 'New!StrongPassword456';

class FakeDatabase {
  users: User[] = [];
  sessions: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    deviceName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  resets: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }> = [];
  sequence = 0;

  user: any;

  constructor() {
    this.user = {
      create: async ({ data }: { data: Partial<User> }) => {
        if (this.users.some((user) => user.email === data.email)) {
          throw new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: '5.22.0',
          });
        }
        const now = new Date();
        const user: User = {
          id: `user-${++this.sequence}`,
          email: data.email!,
          passwordHash: data.passwordHash!,
          displayName: data.displayName!,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          createdAt: now,
          updatedAt: now,
        };
        this.users.push(user);
        return user;
      },
      findUnique: async ({
        where,
      }: {
        where: { email?: string; id?: string };
      }) =>
        this.users.find(
          (user) => user.email === where.email || user.id === where.id,
        ) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const user = this.users.find((candidate) => candidate.id === where.id);
        if (!user) throw new Error('not found');
        return user;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<User>;
      }) => {
        const user = this.users.find((candidate) => candidate.id === where.id)!;
        Object.assign(user, data, { updatedAt: new Date() });
        return user;
      },
    };
  }

  authSession = {
    create: async ({ data }: { data: any }) => {
      const now = new Date();
      const session = {
        id: `session-${++this.sequence}`,
        ...data,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.sessions.push(session);
      return session;
    },
    findUnique: async ({
      where,
      include,
    }: {
      where: { id?: string; tokenHash?: string };
      include?: any;
    }) => {
      const session = this.sessions.find(
        (candidate) =>
          candidate.id === where.id || candidate.tokenHash === where.tokenHash,
      );
      if (!session) return null;
      return include
        ? {
            ...session,
            user: this.users.find((user) => user.id === session.userId)!,
          }
        : session;
    },
    updateMany: async ({ where, data }: { where: any; data: any }) => {
      const matches = this.sessions.filter((session) => {
        if (where.id && typeof where.id === 'string' && session.id !== where.id)
          return false;
        if (where.id?.not && session.id === where.id.not) return false;
        if (where.userId && session.userId !== where.userId) return false;
        if (where.tokenHash && session.tokenHash !== where.tokenHash)
          return false;
        if (where.revokedAt === null && session.revokedAt !== null)
          return false;
        return true;
      });
      matches.forEach((session) => Object.assign(session, data));
      return { count: matches.length };
    },
  };

  passwordResetToken = {
    create: async ({ data }: { data: any }) => {
      const reset = {
        id: `reset-${++this.sequence}`,
        ...data,
        usedAt: null,
        createdAt: new Date(),
      };
      this.resets.push(reset);
      return reset;
    },
    findUnique: async ({
      where,
      include,
    }: {
      where: { tokenHash: string };
      include?: any;
    }) => {
      const reset = this.resets.find(
        (candidate) => candidate.tokenHash === where.tokenHash,
      );
      if (!reset) return null;
      return include
        ? {
            ...reset,
            user: this.users.find((user) => user.id === reset.userId)!,
          }
        : reset;
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const reset = this.resets.find((candidate) => candidate.id === where.id)!;
      Object.assign(reset, data);
      return reset;
    },
    updateMany: async ({ where, data }: { where: any; data: any }) => {
      const matches = this.resets.filter((reset) => {
        if (
          reset.id !== where.id ||
          (where.usedAt === null && reset.usedAt !== null)
        )
          return false;
        return !where.expiresAt?.gt || reset.expiresAt > where.expiresAt.gt;
      });
      matches.forEach((reset) => Object.assign(reset, data));
      return { count: matches.length };
    },
  };

  async $transaction(
    input: Array<Promise<unknown>> | ((database: this) => Promise<unknown>),
  ): Promise<unknown> {
    return typeof input === 'function' ? input(this) : Promise.all(input);
  }
}

class CaptureResetDelivery extends PasswordResetDeliveryService {
  messages: PasswordResetMessage[] = [];
  override async send(message: PasswordResetMessage): Promise<void> {
    this.messages.push(message);
  }
}

describe('AuthService', () => {
  let database: FakeDatabase;
  let delivery: CaptureResetDelivery;
  let service: AuthService;
  let audit: { record: jest.Mock };

  beforeEach(() => {
    database = new FakeDatabase();
    delivery = new CaptureResetDelivery();
    audit = { record: jest.fn().mockResolvedValue({}) };
    const config = new ConfigService({
      JWT_ACCESS_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      JWT_ACCESS_TTL: '15m',
      REFRESH_TOKEN_TTL_DAYS: 30,
      PASSWORD_RESET_TTL_MINUTES: 30,
    });
    service = new AuthService(
      database as unknown as PrismaService,
      new JwtService(),
      config,
      delivery,
      audit as unknown as AuditService,
    );
  });

  const register = () =>
    service.register({
      email: ' User@Example.COM ',
      displayName: 'User',
      password: strongPassword,
    });

  it('registers a normalized USER and never accepts a public ADMIN role', async () => {
    const result = await service.register({
      email: ' User@Example.COM ',
      displayName: 'User',
      password: strongPassword,
      role: UserRole.ADMIN,
    } as never);
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.role).toBe(UserRole.USER);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate registration safely', async () => {
    await register();
    await expect(register()).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials and rejects invalid credentials generically', async () => {
    await register();
    const result = await service.login({
      email: 'USER@example.com',
      password: strongPassword,
    });
    expect(result.accessToken).toBeTruthy();
    await expect(
      service.login({ email: 'missing@example.com', password: 'wrong' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it.each([UserStatus.INACTIVE, UserStatus.SUSPENDED])(
    'rejects %s accounts',
    async (status) => {
      await register();
      database.users[0].status = status;
      await expect(
        service.login({ email: 'user@example.com', password: strongPassword }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('rotates refresh tokens and rejects token reuse', async () => {
    const registered = await register();
    const refreshed = await service.refresh(registered.refreshToken);
    expect(refreshed.refreshToken).not.toBe(registered.refreshToken);
    await expect(service.refresh(registered.refreshToken)).rejects.toThrow(
      'Invalid refresh token',
    );
  });

  it('revokes the current session on logout', async () => {
    const registered = await register();
    const user: AuthenticatedUser = {
      ...registered.user,
      sessionId: database.sessions[0].id,
    };
    await service.logout(user);
    await expect(service.refresh(registered.refreshToken)).rejects.toThrow(
      'Invalid refresh token',
    );
  });

  it('returns a safe current-user profile', async () => {
    const registered = await register();
    const user: AuthenticatedUser = {
      ...registered.user,
      sessionId: database.sessions[0].id,
    };
    const profile = await service.me(user);
    expect(profile.email).toBe('user@example.com');
    expect(profile).not.toHaveProperty('passwordHash');
  });

  it('changes password, rejects the old password, and keeps the current session', async () => {
    const registered = await register();
    const current: AuthenticatedUser = {
      ...registered.user,
      sessionId: database.sessions[0].id,
    };
    await service.changePassword(current, {
      currentPassword: strongPassword,
      newPassword: nextPassword,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PASSWORD_CHANGED',
        targetId: current.id,
      }),
      database,
    );
    await expect(
      service.login({ email: registered.user.email, password: strongPassword }),
    ).rejects.toThrow('Invalid email or password');
    await expect(
      service.login({ email: registered.user.email, password: nextPassword }),
    ).resolves.toBeTruthy();
  });

  it('keeps forgot-password responses enumeration resistant', async () => {
    await expect(
      service.forgotPassword({ email: 'missing@example.com' }),
    ).resolves.toBeUndefined();
    expect(delivery.messages).toHaveLength(0);
  });

  it('resets a password once and revokes existing sessions', async () => {
    const registered = await register();
    await service.forgotPassword({ email: registered.user.email });
    const token = delivery.messages[0].token;
    await service.resetPassword({ token, newPassword: nextPassword });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PASSWORD_RESET_COMPLETED',
        targetId: registered.user.id,
      }),
      database,
    );
    await expect(
      service.resetPassword({ token, newPassword: strongPassword }),
    ).rejects.toThrow('Invalid or expired reset token');
    await expect(service.refresh(registered.refreshToken)).rejects.toThrow(
      'Invalid refresh token',
    );
  });

  it('rejects expired and invalid reset tokens', async () => {
    const registered = await register();
    await service.forgotPassword({ email: registered.user.email });
    database.resets[0].expiresAt = new Date(Date.now() - 1);
    await expect(
      service.resetPassword({
        token: delivery.messages[0].token,
        newPassword: nextPassword,
      }),
    ).rejects.toThrow('Invalid or expired reset token');
    await expect(
      service.resetPassword({
        token: 'x'.repeat(64),
        newPassword: nextPassword,
      }),
    ).rejects.toThrow('Invalid or expired reset token');
  });

  it('validates protected access against session and account state', async () => {
    const registered = await register();
    const payload = {
      sub: registered.user.id,
      role: registered.user.role,
      sid: database.sessions[0].id,
    };
    const strategy = new JwtStrategy(
      new ConfigService({
        JWT_ACCESS_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      }),
      database as unknown as PrismaService,
    );
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      id: registered.user.id,
    });
    database.users[0].status = UserStatus.SUSPENDED;
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
