import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AttendanceService } from './attendance.service';
import { AttendanceHistoryQueryDto } from './dto/attendance.dto';

describe('AttendanceService', () => {
  const notifications = { ensureAttendance: jest.fn() };
  const prisma = {
    attendance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      upsert: jest.fn(),
    },
    attendanceLeavePeriod: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: AttendanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      attendanceEnabled: true,
      leaveModeEnabled: false,
      leaveModeStartedAt: null,
      leaveReason: null,
      attendanceTimezone: 'Asia/Ho_Chi_Minh',
      defaultDailyWorkMinutes: 240,
      workingWeekdays: [1, 2, 3, 4, 5, 6],
    });
    prisma.attendanceLeavePeriod.findFirst.mockResolvedValue(null);
    prisma.attendanceLeavePeriod.findMany.mockResolvedValue([]);
    service = new AttendanceService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
  });

  it('calculates the local date across a UTC date boundary', () => {
    expect(
      service
        .localDate('Asia/Ho_Chi_Minh', new Date('2026-08-28T18:00:00Z'))
        .toISOString(),
    ).toBe('2026-08-29T00:00:00.000Z');
    expect(
      service
        .localDate('America/Los_Angeles', new Date('2026-08-29T02:00:00Z'))
        .toISOString(),
    ).toBe('2026-08-28T00:00:00.000Z');
  });

  it('rejects invalid timezones', () => {
    expect(() => service.localDate('Not/A_Timezone')).toThrow(
      BadRequestException,
    );
  });

  it('returns today before and after check-in for only the current user', async () => {
    prisma.attendance.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'attendance-1', workedMinutes: 240 });
    await expect(service.today('user-1', 'UTC')).resolves.toMatchObject({
      checkedIn: false,
      record: null,
    });
    await expect(service.today('user-1', 'UTC')).resolves.toMatchObject({
      checkedIn: true,
    });
    expect(prisma.attendance.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_attendanceDate: expect.objectContaining({ userId: 'user-1' }),
        },
      }),
    );
  });

  it('checks in using server time and the unique user/date key', async () => {
    prisma.attendance.create.mockResolvedValue({ id: 'attendance-1' });
    await service.checkIn('user-1', 'Asia/Ho_Chi_Minh', ' On time ');
    expect(prisma.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        timezone: 'Asia/Ho_Chi_Minh',
        note: 'On time',
      }),
    });
  });

  it('maps database uniqueness violations to a deterministic duplicate error', async () => {
    prisma.attendance.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );
    await expect(service.checkIn('user-1', 'UTC')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('filters monthly history by current user and deterministic date range', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 'attendance-1',
        attendanceDate: new Date('2026-08-12'),
        workedMinutes: 360,
      },
    ]);
    prisma.attendance.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    prisma.attendance.aggregate.mockResolvedValue({
      _count: 1,
      _sum: { workedMinutes: 360 },
    });
    const query = Object.assign(new AttendanceHistoryQueryDto(), {
      year: 2026,
      month: 8,
    });
    const result = await service.history('user-1', query);
    expect(result.checkedInDays).toBe(1);
    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('allows admin history for an existing selected user and rejects missing users', async () => {
    prisma.user.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.count.mockResolvedValue(0);
    prisma.attendance.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { workedMinutes: null },
    });
    const query = Object.assign(new AttendanceHistoryQueryDto(), {
      year: 2026,
      month: 8,
    });
    await expect(service.adminHistory('user-1', query)).resolves.toMatchObject({
      totalItems: 0,
    });
    await expect(service.adminHistory('missing', query)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('requires a reason for OFF and stores zero minutes without counting a worked day', async () => {
    await expect(
      service.updateDay('user-1', '2000-01-20', {
        workedMinutes: 0,
        timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.attendance.upsert.mockResolvedValue({ id: 'off-1' });
    await service.updateDay('user-1', '2000-01-20', {
      workedMinutes: 0,
      timezone: 'UTC',
      offReason: 'Sick leave',
    });
    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          workedMinutes: 0,
          status: 'OFF',
          offReason: 'Sick leave',
        }),
        create: expect.objectContaining({
          workedMinutes: 0,
          status: 'OFF',
          offReason: 'Sick leave',
          source: 'MOBILE',
        }),
      }),
    );
  });

  it('allows the current configured local calendar date', async () => {
    const timezone = 'Asia/Ho_Chi_Minh';
    prisma.attendance.upsert.mockResolvedValue({ id: 'today-1' });
    const today = service.localDate(timezone).toISOString().slice(0, 10);
    await expect(
      service.updateDay('owner-1', today, {
        workedMinutes: 240,
        timezone: 'America/New_York',
      }),
    ).resolves.toEqual({ id: 'today-1' });
  });

  it('creates a missing historical worked record with owner-scoped upsert semantics', async () => {
    prisma.attendance.upsert.mockResolvedValue({
      id: 'manual-1',
      source: 'MOBILE',
      workedMinutes: 360,
    });
    await expect(
      service.updateDay('owner-1', '2026-01-15', {
        workedMinutes: 360,
        timezone: 'America/New_York',
      }),
    ).resolves.toMatchObject({ workedMinutes: 360, source: 'MOBILE' });
    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_attendanceDate: {
            userId: 'owner-1',
            attendanceDate: new Date('2026-01-15T00:00:00.000Z'),
          },
        },
        create: expect.objectContaining({
          userId: 'owner-1',
          workedMinutes: 360,
          source: 'MOBILE',
          timezone: 'Asia/Ho_Chi_Minh',
        }),
      }),
    );
  });

  it('edits an existing automatic record as a manual user update', async () => {
    prisma.attendance.upsert.mockResolvedValue({
      id: 'auto-1',
      source: 'MOBILE',
      workedMinutes: 450,
      autoRecordedAt: new Date('2026-01-15T01:00:00Z'),
    });
    await service.updateDay('owner-1', '2026-01-15', {
      workedMinutes: 450,
      timezone: 'UTC',
    });
    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          workedMinutes: 450,
          source: 'MOBILE',
        }),
      }),
    );
  });

  it('rejects malformed, impossible, and future calendar dates', async () => {
    await expect(
      service.updateDay('owner-1', '2026/01/15', {
        workedMinutes: 240,
        timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateDay('owner-1', '2026-02-30', {
        workedMinutes: 240,
        timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateDay('owner-1', '2100-01-01', {
        workedMinutes: 240,
        timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permits historical editing during Leave Mode but blocks disabled Attendance', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      attendanceEnabled: true,
      leaveModeEnabled: true,
      attendanceTimezone: 'UTC',
      defaultDailyWorkMinutes: 240,
      workingWeekdays: [1, 2, 3, 4, 5, 6],
    });
    prisma.attendance.upsert.mockResolvedValue({ id: 'manual-1' });
    await expect(
      service.updateDay('owner-1', '2026-01-15', {
        workedMinutes: 240,
        timezone: 'UTC',
      }),
    ).resolves.toEqual({ id: 'manual-1' });

    prisma.user.findUnique.mockResolvedValueOnce({
      attendanceEnabled: false,
      leaveModeEnabled: false,
      attendanceTimezone: 'UTC',
      defaultDailyWorkMinutes: 240,
      workingWeekdays: [1, 2, 3, 4, 5, 6],
    });
    await expect(
      service.updateDay('owner-1', '2026-01-15', {
        workedMinutes: 240,
        timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists Leave Mode until the user explicitly disables it', async () => {
    prisma.user.update.mockResolvedValue({ leaveModeEnabled: true });
    await service.setLeaveMode('user-1', true, 'Annual leave');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaveModeEnabled: true,
          leaveReason: 'Annual leave',
        }),
      }),
    );
  });

  it('creates one 240-minute automatic record and its idempotent notification', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        attendanceTimezone: 'Asia/Ho_Chi_Minh',
        defaultDailyWorkMinutes: 240,
        workingWeekdays: [1, 2, 3, 4, 5, 6],
      },
    ]);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.attendance.create.mockResolvedValue({ id: 'auto-1' });
    notifications.ensureAttendance.mockResolvedValue({ id: 'notification-1' });
    await expect(
      service.runAutomatic(new Date('2026-09-02T01:00:00Z')),
    ).resolves.toEqual({ eligibleUsers: 1, created: 1 });
    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workedMinutes: 240,
          source: 'AUTO',
          attendanceDate: new Date('2026-09-02T00:00:00.000Z'),
        }),
      }),
    );
    expect(notifications.ensureAttendance).toHaveBeenCalledWith('auto-1');
  });

  it('skips automatic work on scheduled off and leave-covered dates', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        attendanceTimezone: 'UTC',
        defaultDailyWorkMinutes: 360,
        workingWeekdays: [1, 2, 3, 4, 5, 6],
      },
    ]);
    await expect(
      service.runAutomatic(new Date('2026-09-06T08:00:00Z')),
    ).resolves.toEqual({ eligibleUsers: 1, created: 0 });
    expect(prisma.attendance.create).not.toHaveBeenCalled();

    prisma.attendanceLeavePeriod.findFirst.mockResolvedValue({ id: 'leave-1' });
    await expect(
      service.runAutomatic(new Date('2026-09-07T08:00:00Z')),
    ).resolves.toEqual({ eligibleUsers: 1, created: 0 });
    expect(notifications.ensureAttendance).not.toHaveBeenCalled();
  });

  it('creates, updates, and deletes only owner-scoped leave periods', async () => {
    const dto = {
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      reason: 'Annual leave',
      note: 'Trip',
    };
    prisma.attendanceLeavePeriod.create.mockResolvedValue({ id: 'leave-1' });
    await service.createLeavePeriod('owner-1', dto);
    expect(prisma.attendanceLeavePeriod.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'owner-1',
        reason: 'Annual leave',
      }),
    });

    prisma.attendanceLeavePeriod.updateMany.mockResolvedValue({ count: 1 });
    prisma.attendanceLeavePeriod.findFirstOrThrow.mockResolvedValue({
      id: 'leave-1',
    });
    await service.updateLeavePeriod('owner-1', 'leave-1', dto);
    expect(prisma.attendanceLeavePeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'leave-1', userId: 'owner-1' } }),
    );

    prisma.attendanceLeavePeriod.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(
      service.deleteLeavePeriod('owner-1', 'leave-1'),
    ).resolves.toEqual({ deleted: true });
    prisma.attendanceLeavePeriod.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.deleteLeavePeriod('other-user', 'leave-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid and overlong leave ranges', async () => {
    await expect(
      service.createLeavePeriod('owner-1', {
        startDate: '2026-10-03',
        endDate: '2026-10-01',
        reason: 'Annual leave',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createLeavePeriod('owner-1', {
        startDate: '2026-01-01',
        endDate: '2027-01-02',
        reason: 'Annual leave',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('derives timesheet precedence and avoids double counting', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-20T08:00:00Z'));
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 'worked',
        attendanceDate: new Date('2026-09-01'),
        workedMinutes: 300,
        status: 'WORKED',
      },
      {
        id: 'off',
        attendanceDate: new Date('2026-09-02'),
        workedMinutes: 0,
        status: 'OFF',
      },
      {
        id: 'override',
        attendanceDate: new Date('2026-09-03'),
        workedMinutes: 120,
        status: 'WORKED',
      },
    ]);
    prisma.attendance.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.attendance.aggregate.mockResolvedValue({
      _count: 2,
      _sum: { workedMinutes: 420 },
    });
    prisma.attendanceLeavePeriod.findMany.mockResolvedValue([
      {
        id: 'leave-1',
        startDate: new Date('2026-09-03'),
        endDate: new Date('2026-09-04'),
        reason: 'Annual leave',
      },
    ]);
    const query = Object.assign(new AttendanceHistoryQueryDto(), {
      year: 2026,
      month: 9,
    });
    const result = await service.history('owner-1', query);
    expect(result).toMatchObject({
      workedDays: 2,
      totalWorkedMinutes: 420,
      offDays: 1,
      leaveDays: 1,
    });
    expect(result.days.find((day) => day.date === '2026-09-03')?.state).toBe(
      'WORKED',
    );
    expect(result.days.find((day) => day.date === '2026-09-04')?.state).toBe(
      'LEAVE',
    );
    expect(result.days.find((day) => day.date === '2026-09-06')?.state).toBe(
      'SCHEDULED_OFF',
    );
    expect(result.days.find((day) => day.date === '2026-09-07')?.state).toBe(
      'NO_RECORD',
    );
    expect(result.days.find((day) => day.date === '2026-09-21')?.state).toBe(
      'FUTURE',
    );
    jest.useRealTimers();
  });
});
