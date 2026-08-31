import { Injectable, Logger } from '@nestjs/common';
import { GoldAlertPriceSide, NotificationType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationJobsService } from './notification-jobs.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: NotificationJobsService,
  ) {}
  async ensureGoldAlert(triggerId: string) {
    const trigger = await this.prisma.goldAlertTrigger.findUniqueOrThrow({
      where: { id: triggerId },
      include: { alert: true },
    });
    const observed =
      trigger.alert.priceSide === GoldAlertPriceSide.BUY
        ? trigger.observedBuyPrice
        : trigger.observedSellPrice;
    const notification = await this.prisma.notification.upsert({
      where: { goldAlertTriggerId: trigger.id },
      update: {},
      create: {
        userId: trigger.userId,
        goldAlertTriggerId: trigger.id,
        type: NotificationType.GOLD_ALERT,
        title: 'Gold price alert',
        body: `${trigger.productCode} ${trigger.alert.priceSide.toLowerCase()} price ${trigger.condition.toLowerCase()} condition matched at ${observed.toLocaleString('en-US')} VND/lượng.`,
        data: { type: 'GOLD_ALERT', route: '/gold', alertId: trigger.alertId },
      },
    });
    try {
      await this.jobs.enqueue(notification.id);
    } catch (error) {
      this.logger.warn(
        `Notification ${notification.id} will remain pending: ${String(error)}`,
      );
    }
    return notification;
  }
}
