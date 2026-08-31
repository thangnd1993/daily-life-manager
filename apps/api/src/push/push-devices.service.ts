import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegisterPushDeviceDto } from './dto/push-device.dto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PushDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: RegisterPushDeviceDto) {
    const existing = await this.prisma.pushDevice.findUnique({
      where: { pushToken: dto.pushToken },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictException('Push device is already registered');
    }
    const device = await this.prisma.pushDevice.upsert({
      where: { pushToken: dto.pushToken },
      create: { userId, platform: dto.platform, pushToken: dto.pushToken },
      update: {
        platform: dto.platform,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
    return this.safe(device);
  }

  async list(userId: string) {
    return (
      await this.prisma.pushDevice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
    ).map((item) => this.safe(item));
  }

  async deactivate(userId: string, id: string) {
    const result = await this.prisma.pushDevice.updateMany({
      where: { id, userId },
      data: { isActive: false },
    });
    if (!result.count) throw new NotFoundException('Push device not found');
  }

  private safe<
    T extends {
      id: string;
      platform: unknown;
      isActive: boolean;
      lastSeenAt: Date;
      createdAt: Date;
      updatedAt: Date;
    },
  >(device: T) {
    return {
      id: device.id,
      platform: device.platform,
      isActive: device.isActive,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }
}
