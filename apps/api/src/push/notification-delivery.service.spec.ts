import { NotificationDeliveryStatus } from '@prisma/client';
import { FcmSendError } from './fcm.service';
import { NotificationDeliveryService } from './notification-delivery.service';

describe('NotificationDeliveryService', () => {
  const prisma = {
    notification: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    pushDevice: { findMany: jest.fn(), update: jest.fn() },
    notificationDelivery: {
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const fcm = { send: jest.fn() };
  const service = new NotificationDeliveryService(
    prisma as never,
    fcm as never,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notification.findUniqueOrThrow.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      title: 'Gold price alert',
      body: 'body',
      data: { type: 'GOLD_ALERT', route: '/gold' },
    });
  });

  it('persists successful per-device delivery and aggregate success', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([
      { id: 'd1', pushToken: 'token' },
    ]);
    prisma.notificationDelivery.upsert.mockResolvedValue({
      id: 'x1',
      status: NotificationDeliveryStatus.PENDING,
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { status: NotificationDeliveryStatus.SENT },
    ]);
    fcm.send.mockResolvedValue('provider-message');
    await service.deliver('n1');
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerMessageId: 'provider-message',
        }),
      }),
    );
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });

  it('deactivates a permanently invalid token without retrying', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([
      { id: 'd1', pushToken: 'token' },
    ]);
    prisma.notificationDelivery.upsert.mockResolvedValue({
      id: 'x1',
      status: NotificationDeliveryStatus.PENDING,
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { status: NotificationDeliveryStatus.FAILED },
    ]);
    fcm.send.mockRejectedValue(
      new FcmSendError('messaging/registration-token-not-registered', true),
    );
    await service.deliver('n1');
    expect(prisma.pushDevice.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { isActive: false },
    });
  });

  it('marks no-device notifications deterministically', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([]);
    await service.deliver('n1');
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
});
