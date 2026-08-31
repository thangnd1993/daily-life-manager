import { Injectable } from '@nestjs/common';
import { NotificationDeliveryStatus, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FcmSendError, FcmService } from './fcm.service';

@Injectable()
export class NotificationDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  async deliver(notificationId: string) {
    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
    });
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId: notification.userId, isActive: true },
    });
    if (!devices.length) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: NotificationStatus.FAILED, failedAt: new Date() },
      });
      return;
    }
    let temporaryFailure = false;
    for (const device of devices) {
      const delivery = await this.prisma.notificationDelivery.upsert({
        where: {
          notificationId_deviceId: { notificationId, deviceId: device.id },
        },
        create: { notificationId, deviceId: device.id },
        update: {},
      });
      if (delivery.status === NotificationDeliveryStatus.SENT) continue;
      const now = new Date();
      try {
        const data = notification.data as Record<string, string>;
        const providerMessageId = await this.fcm.send({
          token: device.pushToken,
          title: notification.title,
          body: notification.body,
          data,
        });
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.SENT,
            providerMessageId,
            attemptCount: { increment: 1 },
            lastAttemptAt: now,
            errorCode: null,
          },
        });
      } catch (error) {
        const failure =
          error instanceof FcmSendError
            ? error
            : new FcmSendError('provider-unavailable', false);
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.FAILED,
            attemptCount: { increment: 1 },
            lastAttemptAt: now,
            errorCode: failure.code,
          },
        });
        if (failure.permanent)
          await this.prisma.pushDevice.update({
            where: { id: device.id },
            data: { isActive: false },
          });
        else temporaryFailure = true;
      }
    }
    await this.aggregate(notificationId);
    if (temporaryFailure)
      throw new FcmSendError('temporary-delivery-failure', false);
  }

  private async aggregate(id: string) {
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { notificationId: id },
      select: { status: true },
    });
    const sent = deliveries.filter(
      (item) => item.status === NotificationDeliveryStatus.SENT,
    ).length;
    const status =
      sent === deliveries.length
        ? NotificationStatus.SENT
        : sent
          ? NotificationStatus.PARTIAL
          : NotificationStatus.FAILED;
    await this.prisma.notification.update({
      where: { id },
      data: {
        status,
        sentAt: sent ? new Date() : null,
        failedAt: status === NotificationStatus.FAILED ? new Date() : null,
      },
    });
  }
}
