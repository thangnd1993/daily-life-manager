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
  LeavePeriodDto,
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
        workingWeekdays: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async today(userId: string, _timezone: string) {
    void _timezone; // Kept for backward-compatible clients; configured timezone is authoritative.
    const config = await this.config(userId);
    const attendanceDate = this.localDate(config.attendanceTimezone);
    const [record, leavePeriod] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { userId_attendanceDate: { userId, attendanceDate } },
      }),
      this.prisma.attendanceLeavePeriod.findFirst({
        where: {
          userId,
          startDate: { lte: attendanceDate },
          endDate: { gte: attendanceDate },
        },
      }),
    ]);
    const scheduledWorking = config.workingWeekdays.includes(
      this.weekday(attendanceDate),
    );
    return {
      featureEnabled: config.attendanceEnabled,
      leaveModeEnabled: config.leaveModeEnabled,
      leaveReason: config.leaveReason,
      defaultDailyWorkMinutes: config.defaultDailyWorkMinutes,
      checkedIn: !!record && record.workedMinutes > 0,
      attendanceDate,
      record,
      leavePeriod,
      scheduledWorking,
      derivedState: record
        ? record.workedMinutes > 0
          ? 'WORKED'
          : 'OFF'
        : leavePeriod
          ? 'LEAVE'
          : scheduledWorking
            ? 'NO_RECORD'
            : 'SCHEDULED_OFF',
    };
  }

  private weekday(date: Date) {
    return date.getUTCDay() || 7;
  }

  private parseCalendarDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException('Date must use YYYY-MM-DD');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Invalid date');
    return date;
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
    const attendanceDate = this.parseCalendarDate(date);
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

  private leaveDates(dto: LeavePeriodDto) {
    const startDate = this.parseCalendarDate(dto.startDate);
    const endDate = this.parseCalendarDate(dto.endDate);
    const duration =
      Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (duration < 1)
      throw new BadRequestException('Start date must not follow end date');
    if (duration > 366)
      throw new BadRequestException('Leave period cannot exceed 366 days');
    return { startDate, endDate };
  }

  async listLeavePeriods(userId: string) {
    return this.prisma.attendanceLeavePeriod.findMany({
      where: { userId },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
    });
  }

  async createLeavePeriod(userId: string, dto: LeavePeriodDto) {
    const config = await this.config(userId);
    if (!config.attendanceEnabled)
      throw new ForbiddenException('Attendance is disabled');
    const dates = this.leaveDates(dto);
    return this.prisma.attendanceLeavePeriod.create({
      data: {
        userId,
        ...dates,
        reason: dto.reason.trim(),
        note: dto.note?.trim() || null,
      },
    });
  }

  async updateLeavePeriod(userId: string, id: string, dto: LeavePeriodDto) {
    const config = await this.config(userId);
    if (!config.attendanceEnabled)
      throw new ForbiddenException('Attendance is disabled');
    const dates = this.leaveDates(dto);
    const result = await this.prisma.attendanceLeavePeriod.updateMany({
      where: { id, userId },
      data: {
        ...dates,
        reason: dto.reason.trim(),
        note: dto.note?.trim() || null,
      },
    });
    if (!result.count) throw new NotFoundException('Leave period not found');
    return this.prisma.attendanceLeavePeriod.findFirstOrThrow({
      where: { id, userId },
    });
  }

  async deleteLeavePeriod(userId: string, id: string) {
    const result = await this.prisma.attendanceLeavePeriod.deleteMany({
      where: { id, userId },
    });
    if (!result.count) throw new NotFoundException('Leave period not found');
    return { deleted: true };
  }

  async history(userId: string, query: AttendanceHistoryQueryDto) {
    const start = new Date(Date.UTC(query.year, query.month - 1, 1));
    const end = new Date(Date.UTC(query.year, query.month, 1));
    const where = { userId, attendanceDate: { gte: start, lt: end } };
    const [items, totalItems, totals, offDays, config, leavePeriods] =
      await Promise.all([
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
        this.prisma.attendanceLeavePeriod.findMany({
          where: { userId, startDate: { lt: end }, endDate: { gte: start } },
          orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        }),
      ]);
    const byDate = new Map(
      items.map((item) => [
        item.attendanceDate.toISOString().slice(0, 10),
        item,
      ]),
    );
    const today = this.localDate(config.attendanceTimezone);
    const dayCount = new Date(
      Date.UTC(query.year, query.month, 0),
    ).getUTCDate();
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(Date.UTC(query.year, query.month - 1, index + 1));
      const dateKey = date.toISOString().slice(0, 10);
      const record = byDate.get(dateKey);
      const leavePeriod = leavePeriods.find(
        (period) => period.startDate <= date && period.endDate >= date,
      );
      const scheduledWorking = config.workingWeekdays.includes(
        this.weekday(date),
      );
      const future = date > today;
      const state = record
        ? record.workedMinutes > 0
          ? 'WORKED'
          : 'OFF'
        : leavePeriod
          ? 'LEAVE'
          : !scheduledWorking
            ? 'SCHEDULED_OFF'
            : future
              ? 'FUTURE'
              : 'NO_RECORD';
      return {
        date: dateKey,
        state,
        record: record ?? null,
        leavePeriod: leavePeriod ?? null,
        scheduledWorking,
        future,
      };
    });
    const elapsed = days.filter((day) => !day.future);
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
      leaveDays: elapsed.filter((day) => day.state === 'LEAVE').length,
      scheduledOffDays: elapsed.filter((day) => day.state === 'SCHEDULED_OFF')
        .length,
      missingExpectedDays: elapsed.filter((day) => day.state === 'NO_RECORD')
        .length,
      days,
      leavePeriods,
      workingWeekdays: config.workingWeekdays,
      defaultDailyWorkMinutes: config.defaultDailyWorkMinutes,
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
        workingWeekdays: true,
      },
    });
    let created = 0;
    for (const user of users) {
      const attendanceDate = this.localDate(user.attendanceTimezone, now);
      if (!user.workingWeekdays.includes(this.weekday(attendanceDate)))
        continue;
      const leavePeriod = await this.prisma.attendanceLeavePeriod.findFirst({
        where: {
          userId: user.id,
          startDate: { lte: attendanceDate },
          endDate: { gte: attendanceDate },
        },
        select: { id: true },
      });
      if (leavePeriod) continue;
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
