import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { AuditContext } from '../audit/audit.types';
import { PrismaService } from '../database/prisma.service';
import { ListUsersQueryDto } from './dto/admin-users.dto';
import { AdminUserDetail, PaginatedUsers } from './admin-users.types';

const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  attendanceEnabled: true,
  leaveModeEnabled: true,
  attendanceTimezone: true,
  defaultDailyWorkMinutes: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<PaginatedUsers> {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              {
                email: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                displayName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [query.sortBy]: query.sortDirection,
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: safeUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    };
  }

  async detail(id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        _count: {
          select: {
            authSessions: {
              where: { revokedAt: null, expiresAt: { gt: new Date() } },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { _count, ...safeUser } = user;
    return { ...safeUser, activeSessionCount: _count.authSessions };
  }

  async updateStatus(
    actor: AuthenticatedUser,
    id: string,
    status: UserStatus,
    context?: AuditContext,
  ): Promise<AdminUserDetail> {
    if (actor.id === id && status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        'Administrators cannot disable their own account',
      );
    }
    await this.prisma.$transaction(
      async (transaction) => {
        const target = await transaction.user.findUnique({ where: { id } });
        if (!target) throw new NotFoundException('User not found');
        if (
          target.role === UserRole.ADMIN &&
          target.status === UserStatus.ACTIVE &&
          status !== UserStatus.ACTIVE
        ) {
          const activeAdmins = await transaction.user.count({
            where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
          });
          if (activeAdmins <= 1)
            throw new BadRequestException(
              'At least one active administrator is required',
            );
        }
        await transaction.user.update({ where: { id }, data: { status } });
        if (status !== UserStatus.ACTIVE) {
          await transaction.authSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        await this.audit.record(
          {
            actorUserId: actor.id,
            actorRole: actor.role,
            action: 'ADMIN_USER_STATUS_CHANGED',
            targetType: 'USER',
            targetId: id,
            metadata: { previousStatus: target.status, newStatus: status },
            context,
          },
          transaction,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.detail(id);
  }

  async updateAttendanceEnabled(
    actor: AuthenticatedUser,
    id: string,
    enabled: boolean,
    context?: AuditContext,
  ): Promise<AdminUserDetail> {
    await this.prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({ where: { id } });
      if (!target) throw new NotFoundException('User not found');
      await transaction.user.update({
        where: { id },
        data: {
          attendanceEnabled: enabled,
          ...(enabled
            ? {}
            : {
                leaveModeEnabled: false,
                leaveModeStartedAt: null,
                leaveReason: null,
              }),
        },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          actorRole: actor.role,
          action: enabled
            ? 'ADMIN_ATTENDANCE_ENABLED'
            : 'ADMIN_ATTENDANCE_DISABLED',
          targetType: 'USER',
          targetId: id,
          metadata: { previousEnabled: target.attendanceEnabled, enabled },
          context,
        },
        transaction,
      );
    });
    return this.detail(id);
  }
}
