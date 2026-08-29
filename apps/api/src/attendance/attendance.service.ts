import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceSource, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AttendanceHistoryQueryDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

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

  async today(userId: string, timezone: string) {
    const attendanceDate = this.localDate(timezone);
    const record = await this.prisma.attendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate } },
    });
    return { checkedIn: !!record, attendanceDate, record };
  }

  async checkIn(userId: string, timezone: string, note?: string) {
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
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Already checked in for this local date');
      }
      throw error;
    }
  }

  async history(userId: string, query: AttendanceHistoryQueryDto) {
    const start = new Date(Date.UTC(query.year, query.month - 1, 1));
    const end = new Date(Date.UTC(query.year, query.month, 1));
    const where = { userId, attendanceDate: { gte: start, lt: end } };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ attendanceDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
      year: query.year,
      month: query.month,
      checkedInDays: totalItems,
      attendanceDates: items.map((item) => item.attendanceDate),
    };
  }

  async adminHistory(userId: string, query: AttendanceHistoryQueryDto) {
    const exists = await this.prisma.user.count({ where: { id: userId } });
    if (!exists) throw new NotFoundException('User not found');
    return this.history(userId, query);
  }
}
