import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GoldAlertCondition, GoldAlertPriceSide } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateGoldAlertDto, UpdateGoldAlertDto } from './dto/gold-alert.dto';
import { NotificationsService } from '../push/notifications.service';

@Injectable()
export class GoldAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string) {
    const alerts = await this.prisma.goldAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map((alert) => this.safeAlert(alert));
  }

  async create(userId: string, dto: CreateGoldAlertDto) {
    this.validateCombination(dto);
    const alert = await this.prisma.goldAlert.create({
      data: { userId, ...this.data(dto) },
    });
    return this.safeAlert(alert);
  }

  async update(userId: string, id: string, dto: UpdateGoldAlertDto) {
    await this.owned(userId, id);
    this.validateCombination(dto);
    const alert = await this.prisma.goldAlert.update({
      where: { id },
      data: { ...this.data(dto), isEnabled: dto.isEnabled },
    });
    return this.safeAlert(alert);
  }

  async setEnabled(userId: string, id: string, isEnabled: boolean) {
    await this.owned(userId, id);
    const alert = await this.prisma.goldAlert.update({
      where: { id },
      data: { isEnabled, wasMatching: false },
    });
    return this.safeAlert(alert);
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    await this.prisma.goldAlert.delete({ where: { id } });
  }

  async history(userId: string) {
    const triggers = await this.prisma.goldAlertTrigger.findMany({
      where: { userId },
      orderBy: { triggeredAt: 'desc' },
      take: 100,
    });
    return triggers.map((item) => ({
      ...item,
      observedBuyPrice: item.observedBuyPrice.toString(),
      observedSellPrice: item.observedSellPrice.toString(),
    }));
  }

  async evaluate() {
    const alerts = await this.prisma.goldAlert.findMany({
      where: { isEnabled: true },
    });
    const now = new Date();
    let triggered = 0;
    for (const alert of alerts) {
      const latest = await this.prisma.goldPriceSnapshot.findFirst({
        where: { productCode: alert.productCode },
        orderBy: { sourceTimestamp: 'desc' },
      });
      if (!latest) continue;
      let matchedValue: string;
      let matches: boolean;
      const observed =
        alert.priceSide === GoldAlertPriceSide.BUY
          ? latest.buyPrice
          : latest.sellPrice;
      if (alert.condition === GoldAlertCondition.PERCENT_CHANGE) {
        const baseline = await this.prisma.goldPriceSnapshot.findFirst({
          where: {
            productCode: alert.productCode,
            sourceTimestamp: {
              lte: new Date(latest.sourceTimestamp.getTime() - 86_400_000),
            },
          },
          orderBy: { sourceTimestamp: 'desc' },
        });
        if (!baseline) continue;
        const reference =
          alert.priceSide === GoldAlertPriceSide.BUY
            ? baseline.buyPrice
            : baseline.sellPrice;
        const basisPoints =
          (this.abs(observed - reference) * 10_000n) / reference;
        matchedValue = basisPoints.toString();
        matches = basisPoints >= BigInt(alert.thresholdBasisPoints ?? 0);
      } else {
        const threshold = alert.thresholdAmount ?? 0n;
        matchedValue = observed.toString();
        matches =
          alert.condition === GoldAlertCondition.ABOVE
            ? observed > threshold
            : observed < threshold;
      }
      const cooldownOver =
        !alert.lastTriggeredAt ||
        now.getTime() - alert.lastTriggeredAt.getTime() >=
          alert.cooldownMinutes * 60_000;
      if (matches && !alert.wasMatching && cooldownOver) {
        const [trigger] = await this.prisma.$transaction([
          this.prisma.goldAlertTrigger.create({
            data: {
              alertId: alert.id,
              userId: alert.userId,
              productCode: alert.productCode,
              observedBuyPrice: latest.buyPrice,
              observedSellPrice: latest.sellPrice,
              matchedValue,
              condition: alert.condition,
              triggeredAt: now,
            },
          }),
          this.prisma.goldAlert.update({
            where: { id: alert.id },
            data: {
              wasMatching: true,
              lastTriggeredAt: now,
              lastEvaluatedAt: now,
            },
          }),
        ]);
        try {
          await this.notifications.ensureGoldAlert(trigger.id);
        } catch {
          /* durable trigger is authoritative; a later reconciliation may retry */
        }
        triggered++;
      } else {
        await this.prisma.goldAlert.update({
          where: { id: alert.id },
          data: { wasMatching: matches, lastEvaluatedAt: now },
        });
      }
    }
    await this.reconcileNotifications();
    return { evaluated: alerts.length, triggered, evaluatedAt: now };
  }

  private async reconcileNotifications() {
    const missing = await this.prisma.goldAlertTrigger.findMany({
      where: { notification: null },
      orderBy: { triggeredAt: 'asc' },
      take: 100,
      select: { id: true },
    });
    for (const trigger of missing) {
      try {
        await this.notifications.ensureGoldAlert(trigger.id);
      } catch {
        // The next existing Gold Alert evaluation retries without affecting triggers.
      }
    }
  }

  private data(dto: CreateGoldAlertDto) {
    return {
      productCode: dto.productCode,
      priceSide: dto.priceSide,
      condition: dto.condition,
      thresholdAmount:
        dto.condition === GoldAlertCondition.PERCENT_CHANGE
          ? null
          : BigInt(dto.thresholdAmount!),
      thresholdBasisPoints:
        dto.condition === GoldAlertCondition.PERCENT_CHANGE
          ? dto.thresholdBasisPoints
          : null,
      cooldownMinutes: dto.cooldownMinutes,
      wasMatching: false,
    };
  }

  private validateCombination(dto: CreateGoldAlertDto) {
    const percentage = dto.condition === GoldAlertCondition.PERCENT_CHANGE;
    if (
      (percentage &&
        (!dto.thresholdBasisPoints || dto.thresholdAmount !== undefined)) ||
      (!percentage &&
        (!dto.thresholdAmount || dto.thresholdBasisPoints !== undefined))
    )
      throw new BadRequestException('Invalid threshold for alert condition');
  }

  private async owned(userId: string, id: string) {
    const alert = await this.prisma.goldAlert.findFirst({
      where: { id, userId },
    });
    if (!alert) throw new NotFoundException('Gold alert not found');
    return alert;
  }

  private safeAlert<T extends { thresholdAmount: bigint | null }>(alert: T) {
    return {
      ...alert,
      thresholdAmount: alert.thresholdAmount?.toString() ?? null,
    };
  }

  private abs(value: bigint) {
    return value < 0n ? -value : value;
  }
}
