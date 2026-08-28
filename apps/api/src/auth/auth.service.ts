import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import {
  AccessTokenPayload,
  AuthenticatedUser,
  AuthResponse,
  SafeUser,
} from './auth.types';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';

const invalidCredentials = 'Invalid email or password';
const invalidRefreshToken = 'Invalid refresh token';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly resetDelivery: PasswordResetDeliveryService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          displayName: dto.displayName.trim(),
          passwordHash: await this.hashPassword(dto.password),
        },
      });
      return this.createSession(user, dto.deviceName);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException(invalidCredentials);
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.createSession(updated, dto.deviceName);
  }

  async refresh(rawToken: string): Promise<AuthResponse> {
    const tokenHash = this.digestToken(rawToken);
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException(invalidRefreshToken);
    }

    const nextRefreshToken = this.generateToken();
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, tokenHash, revokedAt: null },
      data: {
        tokenHash: this.digestToken(nextRefreshToken),
        expiresAt: this.refreshExpiry(),
      },
    });
    if (rotated.count !== 1)
      throw new UnauthorizedException(invalidRefreshToken);

    return {
      accessToken: await this.signAccessToken(session.user, session.id),
      refreshToken: nextRefreshToken,
      user: this.safeUser(session.user),
    };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: user.sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(user: AuthenticatedUser): Promise<SafeUser> {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    return this.safeUser(account);
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (!(await argon2.verify(account.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.authSession.updateMany({
        where: {
          userId: user.id,
          id: { not: user.sessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });
    if (!user || user.status !== UserStatus.ACTIVE) return;

    const token = this.generateToken();
    const expiresAt = new Date(
      Date.now() +
        this.config.get<number>('PASSWORD_RESET_TTL_MINUTES', 30) * 60 * 1000,
    );
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: this.digestToken(token), expiresAt },
    });
    await this.resetDelivery.send({
      email: user.email,
      displayName: user.displayName,
      token,
      expiresAt,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.digestToken(dto.token) },
      include: { user: true },
    });
    if (
      !reset ||
      reset.usedAt ||
      reset.expiresAt <= new Date() ||
      reset.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException('Invalid or expired reset token');
      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      });
      await transaction.authSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private async createSession(
    user: User,
    deviceName?: string,
  ): Promise<AuthResponse> {
    const refreshToken = this.generateToken();
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: this.digestToken(refreshToken),
        expiresAt: this.refreshExpiry(),
        deviceName: deviceName?.trim() || null,
      },
    });
    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      user: this.safeUser(user),
    };
  }

  private signAccessToken(user: User, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      sid: sessionId,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as never,
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private generateToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private digestToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private refreshExpiry(): Date {
    return new Date(
      Date.now() +
        this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30) *
          24 *
          60 *
          60 *
          1000,
    );
  }

  private safeUser(user: User): SafeUser {
    const {
      id,
      email,
      displayName,
      role,
      status,
      emailVerifiedAt,
      lastLoginAt,
      createdAt,
      updatedAt,
    } = user;
    return {
      id,
      email,
      displayName,
      role,
      status,
      emailVerifiedAt,
      lastLoginAt,
      createdAt,
      updatedAt,
    };
  }
}
