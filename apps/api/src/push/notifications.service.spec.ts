import { GoldAlertPriceSide, NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    goldAlertTrigger: { findUniqueOrThrow: jest.fn() },
    notification: { upsert: jest.fn() },
  };
  const jobs = { enqueue: jest.fn() };
  const service = new NotificationsService(prisma as never, jobs as never);

  it('uses trigger uniqueness and the trigger owner for safe Gold Alert content', async () => {
    prisma.goldAlertTrigger.findUniqueOrThrow.mockResolvedValue({
      id: 'trigger-1',
      alertId: 'alert-1',
      userId: 'user-1',
      productCode: 'SJC',
      condition: 'ABOVE',
      observedBuyPrice: 92_500_000n,
      observedSellPrice: 93_000_000n,
      alert: { priceSide: GoldAlertPriceSide.BUY },
    });
    prisma.notification.upsert.mockResolvedValue({ id: 'notification-1' });
    await service.ensureGoldAlert('trigger-1');
    expect(prisma.notification.upsert).toHaveBeenCalledWith({
      where: { goldAlertTriggerId: 'trigger-1' },
      update: {},
      create: expect.objectContaining({
        userId: 'user-1',
        goldAlertTriggerId: 'trigger-1',
        type: NotificationType.GOLD_ALERT,
        title: 'Gold price alert',
        data: { type: 'GOLD_ALERT', route: '/gold', alertId: 'alert-1' },
      }),
    });
    expect(jobs.enqueue).toHaveBeenCalledWith('notification-1');
  });
});
