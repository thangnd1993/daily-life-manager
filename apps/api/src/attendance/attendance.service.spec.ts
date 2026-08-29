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
  const prisma = {
    attendance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: AttendanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceService(prisma as unknown as PrismaService);
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
      .mockResolvedValueOnce({ id: 'attendance-1' });
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
    prisma.attendance.findMany.mockReturnValue('items-query');
    prisma.attendance.count.mockReturnValue('count-query');
    prisma.$transaction.mockResolvedValue([
      [{ id: 'attendance-1', attendanceDate: new Date('2026-08-12') }],
      1,
    ]);
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
    prisma.$transaction.mockResolvedValue([[], 0]);
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
});
