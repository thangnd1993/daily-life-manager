import {
  BadRequestException,
  ConflictException,
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
    });
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
      service.updateDay('user-1', '2026-08-20', {
        workedMinutes: 0,
        timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.attendance.upsert.mockResolvedValue({ id: 'off-1' });
    await service.updateDay('user-1', '2026-08-20', {
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
      }),
    );
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
});
