import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceSource,
  AttendanceStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../push/notifications.service';
import {
  AttendanceHistoryQueryDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  localDate(timezone: string, now = new Date()): Date {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);
      const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value;
      return new Date(
        `${value('year')}-${value('month')}-${value('day')}T00:00:00.000Z`,
      );
    } catch {
      throw new BadRequestException('Invalid IANA timezone');
    }
  }

  private async config(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        attendanceEnabled: true,
        leaveModeEnabled: true,
        leaveModeStartedAt: true,
        leaveReason: true,
        attendanceTimezone: true,
        defaultDailyWorkMinutes: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async today(userId: string, timezone: string) {
    const config = await this.config(userId);
    const attendanceDate = this.localDate(timezone);
    const record = await this.prisma.attendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate } },
    });
    return {
      featureEnabled: config.attendanceEnabled,
      leaveModeEnabled: config.leaveModeEnabled,
      leaveReason: config.leaveReason,
      defaultDailyWorkMinutes: config.defaultDailyWorkMinutes,
      checkedIn: !!record && record.workedMinutes > 0,
      attendanceDate,
      record,
    };
  }

  async checkIn(userId: string, timezone: string, note?: string) {
    const config = await this.config(userId);
    if (!config.attendanceEnabled)
      throw new ForbiddenException('Attendance is disabled');
    const checkedInAt = new Date();
    const attendanceDate = this.localDate(timezone, checkedInAt);
    try {
      return await this.prisma.attendance.create({
        data: {
          userId,
          attendanceDate,
          checkedInAt,
          timezone,
          source: AttendanceSource.MOBILE,
          note: note?.trim() || null,
          workedMinutes: config.defaultDailyWorkMinutes,
          status: AttendanceStatus.WORKED,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'A work record already exists for this local date',
        );
      throw error;
    }
  }

  async updateDay(userId: string, date: string, dto: UpdateAttendanceDto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new BadRequestException('Date must use YYYY-MM-DD');
    const attendanceDate = new Date(`${date}T00:00:00.000Z`);
    if (
      Number.isNaN(attendanceDate.getTime()) ||
      attendanceDate.toISOString().slice(0, 10) !== date
    )
      throw new BadRequestException('Invalid date');
    const config = await this.config(userId);
    if (!config.attendanceEnabled)
      throw new ForbiddenException('Attendance is disabled');
    if (attendanceDate > this.localDate(config.attendanceTimezone))
      throw new BadRequestException('Future attendance cannot be edited');
    const reason = dto.offReason?.trim() || null;
    if (dto.workedMinutes === 0 && !reason)
      throw new BadRequestException('An OFF reason is required');
    const status =
      dto.workedMinutes > 0 ? AttendanceStatus.WORKED : AttendanceStatus.OFF;
    return this.prisma.attendance.upsert({
      where: { userId_attendanceDate: { userId, attendanceDate } },
      update: {
        workedMinutes: dto.workedMinutes,
        status,
        offReason: status === AttendanceStatus.OFF ? reason : null,
        source: AttendanceSource.MOBILE,
        timezone: config.attendanceTimezone,
      },
      create: {
        userId,
        attendanceDate,
        workedMinutes: dto.workedMinutes,
        status,
        offReason: status === AttendanceStatus.OFF ? reason : null,
        source: AttendanceSource.MOBILE,
        timezone: config.attendanceTimezone,
        checkedInAt: new Date(),
      },
    });
  }

  async setLeaveMode(userId: string, enabled: boolean, reason?: string) {
    const config = await this.config(userId);
    if (!config.attendanceEnabled)
      throw new ForbiddenException('Attendance is disabled');
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        leaveModeEnabled: enabled,
        leaveModeStartedAt: enabled ? new Date() : null,
        leaveReason: enabled ? reason?.trim() || null : null,
      },
      select: {
        attendanceEnabled: true,
        leaveModeEnabled: true,
        leaveModeStartedAt: true,
        leaveReason: true,
      },
    });
  }

  async history(userId: string, query: AttendanceHistoryQueryDto) {
    const start = new Date(Date.UTC(query.year, query.month - 1, 1));
    const end = new Date(Date.UTC(query.year, query.month, 1));
    const where = { userId, attendanceDate: { gte: start, lt: end } };
    const [items, totalItems, totals, offDays, config] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ attendanceDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.aggregate({
        where: { ...where, workedMinutes: { gt: 0 } },
        _count: true,
        _sum: { workedMinutes: true },
      }),
      this.prisma.attendance.count({ where: { ...where, workedMinutes: 0 } }),
      this.config(userId),
    ]);
    return {
      items,
      records: items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
      year: query.year,
      month: query.month,
      workedDays: totals._count,
      checkedInDays: totals._count,
      totalWorkedMinutes: totals._sum.workedMinutes ?? 0,
      offDays,
      attendanceDates: items.map((item) => item.attendanceDate),
      attendanceEnabled: config.attendanceEnabled,
      leaveModeEnabled: config.leaveModeEnabled,
      leaveReason: config.leaveReason,
    };
  }

  async adminHistory(userId: string, query: AttendanceHistoryQueryDto) {
    if (!(await this.prisma.user.count({ where: { id: userId } })))
      throw new NotFoundException('User not found');
    return this.history(userId, query);
  }

  async runAutomatic(now = new Date()) {
    const users = await this.prisma.user.findMany({
      where: {
        attendanceEnabled: true,
        leaveModeEnabled: false,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        attendanceTimezone: true,
        defaultDailyWorkMinutes: true,
      },
    });
    let created = 0;
    for (const user of users) {
      const attendanceDate = this.localDate(user.attendanceTimezone, now);
      const existing = await this.prisma.attendance.findUnique({
        where: { userId_attendanceDate: { userId: user.id, attendanceDate } },
      });
      if (existing) continue;
      try {
        const record = await this.prisma.attendance.create({
          data: {
            userId: user.id,
            attendanceDate,
            workedMinutes: user.defaultDailyWorkMinutes,
            status: AttendanceStatus.WORKED,
            source: AttendanceSource.AUTO,
            timezone: user.attendanceTimezone,
            autoRecordedAt: now,
            checkedInAt: now,
          },
        });
        created++;
        await this.notifications.ensureAttendance(record.id);
      } catch (error) {
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ))
          throw error;
      }
    }
    return { eligibleUsers: users.length, created };
  }
}
