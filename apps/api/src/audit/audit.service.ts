import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditOutcome, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditEvent } from './audit.types';

const sensitiveKey = /password|secret|token|authorization|credential|api.?key/i;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(event: AuditEvent, transaction?: Prisma.TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        actorRole: event.actorRole,
        action: event.action.slice(0, 80),
        targetType: event.targetType.slice(0, 80),
        targetId: event.targetId?.slice(0, 128),
        outcome: event.outcome ?? AuditOutcome.SUCCESS,
        metadata: this.safeMetadata(event.metadata),
        ipAddress: event.context?.ipAddress?.slice(0, 64),
        userAgent: event.context?.userAgent?.slice(0, 256),
      },
    });
  }

  async list(query: AuditLogQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to)
      throw new BadRequestException('from must not be after to');
    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      actorUserId: query.actorUserId,
      targetType: query.targetType,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          actorUserId: true,
          actorRole: true,
          action: true,
          targetType: true,
          targetId: true,
          outcome: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          actor: { select: { displayName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    };
  }

  private safeMetadata(
    metadata?: Record<string, unknown>,
  ): Prisma.InputJsonValue | undefined {
    if (!metadata) return undefined;
    const safe = Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => !sensitiveKey.test(key))
        .slice(0, 20)
        .map(([key, value]) => [key.slice(0, 80), this.safeValue(value)]),
    );
    return JSON.stringify(safe).length <= 2048 ? safe : { truncated: true };
  }

  private safeValue(value: unknown): string | number | boolean | null {
    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value;
    return String(value).slice(0, 200);
  }
}
