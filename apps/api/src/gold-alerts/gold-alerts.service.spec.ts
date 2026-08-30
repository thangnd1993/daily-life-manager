import { GoldAlertCondition, GoldAlertPriceSide } from '@prisma/client';
import { GoldAlertsService } from './gold-alerts.service';

const baseAlert = {
  id: 'alert-1',
  userId: 'user-1',
  productCode: 'SJC',
  priceSide: GoldAlertPriceSide.BUY,
  condition: GoldAlertCondition.ABOVE,
  thresholdAmount: 88_000_000n,
  thresholdBasisPoints: null,
  isEnabled: true,
  cooldownMinutes: 60,
  lastTriggeredAt: null,
  wasMatching: false,
  lastEvaluatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GoldAlertsService', () => {
  const prisma = {
    goldAlert: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    goldAlertTrigger: { findMany: jest.fn(), create: jest.fn() },
    goldPriceSnapshot: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new GoldAlertsService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('creates absolute and percentage alerts with integer-safe thresholds', async () => {
    prisma.goldAlert.create
      .mockResolvedValueOnce(baseAlert)
      .mockResolvedValueOnce({
        ...baseAlert,
        condition: GoldAlertCondition.PERCENT_CHANGE,
        thresholdAmount: null,
        thresholdBasisPoints: 250,
      });
    expect(
      (
        await service.create('user-1', {
          productCode: 'SJC',
          priceSide: GoldAlertPriceSide.BUY,
          condition: GoldAlertCondition.ABOVE,
          thresholdAmount: '88000000',
          cooldownMinutes: 60,
        })
      ).thresholdAmount,
    ).toBe('88000000');
    await service.create('user-1', {
      productCode: 'PNJ',
      priceSide: GoldAlertPriceSide.SELL,
      condition: GoldAlertCondition.PERCENT_CHANGE,
      thresholdBasisPoints: 250,
      cooldownMinutes: 60,
    });
    expect(prisma.goldAlert.create.mock.calls[1][0].data).toMatchObject({
      thresholdAmount: null,
      thresholdBasisPoints: 250,
    });
  });

  it('rejects malformed threshold combinations', async () => {
    await expect(
      service.create('user-1', {
        productCode: 'SJC',
        priceSide: GoldAlertPriceSide.BUY,
        condition: GoldAlertCondition.ABOVE,
        thresholdBasisPoints: 100,
        cooldownMinutes: 60,
      }),
    ).rejects.toThrow('Invalid threshold');
  });

  it('scopes list, update, enable, delete, and history to the owner', async () => {
    prisma.goldAlert.findMany.mockResolvedValue([baseAlert]);
    prisma.goldAlert.findFirst.mockResolvedValue(baseAlert);
    prisma.goldAlert.update.mockResolvedValue({
      ...baseAlert,
      isEnabled: false,
    });
    prisma.goldAlert.delete.mockResolvedValue(baseAlert);
    prisma.goldAlertTrigger.findMany.mockResolvedValue([]);
    await service.list('user-1');
    await service.setEnabled('user-1', 'alert-1', false);
    await service.remove('user-1', 'alert-1');
    await service.history('user-1');
    expect(prisma.goldAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    expect(prisma.goldAlert.findFirst).toHaveBeenCalledWith({
      where: { id: 'alert-1', userId: 'user-1' },
    });
    expect(prisma.goldAlertTrigger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('does not allow mutation of another user alert', async () => {
    prisma.goldAlert.findFirst.mockResolvedValue(null);
    await expect(service.remove('user-2', 'alert-1')).rejects.toThrow(
      'Gold alert not found',
    );
  });

  it('triggers an ABOVE rule once and persists owner plus safe prices', async () => {
    prisma.goldAlert.findMany.mockResolvedValue([baseAlert]);
    prisma.goldPriceSnapshot.findFirst.mockResolvedValue({
      buyPrice: 89_000_000n,
      sellPrice: 91_000_000n,
      sourceTimestamp: new Date(),
    });
    prisma.$transaction.mockResolvedValue([]);
    expect(await service.evaluate()).toMatchObject({
      evaluated: 1,
      triggered: 1,
    });
    expect(prisma.goldAlertTrigger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        observedBuyPrice: 89_000_000n,
        observedSellPrice: 91_000_000n,
      }),
    });
  });

  it('respects side, non-match, disabled filtering, and continuous edge state', async () => {
    prisma.goldAlert.findMany.mockResolvedValue([
      { ...baseAlert, priceSide: GoldAlertPriceSide.SELL, wasMatching: true },
    ]);
    prisma.goldPriceSnapshot.findFirst.mockResolvedValue({
      buyPrice: 80_000_000n,
      sellPrice: 90_000_000n,
      sourceTimestamp: new Date(),
    });
    prisma.goldAlert.update.mockResolvedValue(baseAlert);
    expect(await service.evaluate()).toMatchObject({ triggered: 0 });
    expect(prisma.goldAlert.findMany).toHaveBeenCalledWith({
      where: { isEnabled: true },
    });
  });

  it('honors BELOW and blocks a new edge during cooldown', async () => {
    prisma.goldAlert.findMany.mockResolvedValue([
      {
        ...baseAlert,
        condition: GoldAlertCondition.BELOW,
        thresholdAmount: 90_000_000n,
        lastTriggeredAt: new Date(),
      },
    ]);
    prisma.goldPriceSnapshot.findFirst.mockResolvedValue({
      buyPrice: 89_000_000n,
      sellPrice: 92_000_000n,
      sourceTimestamp: new Date(),
    });
    prisma.goldAlert.update.mockResolvedValue(baseAlert);
    expect(await service.evaluate()).toMatchObject({ triggered: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('evaluates percentage movement against the bounded 24-hour baseline', async () => {
    prisma.goldAlert.findMany.mockResolvedValue([
      {
        ...baseAlert,
        condition: GoldAlertCondition.PERCENT_CHANGE,
        thresholdAmount: null,
        thresholdBasisPoints: 500,
      },
    ]);
    prisma.goldPriceSnapshot.findFirst
      .mockResolvedValueOnce({
        buyPrice: 105n,
        sellPrice: 110n,
        sourceTimestamp: new Date(),
      })
      .mockResolvedValueOnce({ buyPrice: 100n, sellPrice: 100n });
    prisma.$transaction.mockResolvedValue([]);
    expect(await service.evaluate()).toMatchObject({ triggered: 1 });
    expect(prisma.goldAlertTrigger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ matchedValue: '500' }),
    });
  });

  it('handles missing prices safely', async () => {
    prisma.goldAlert.findMany.mockResolvedValue([baseAlert]);
    prisma.goldPriceSnapshot.findFirst.mockResolvedValue(null);
    expect(await service.evaluate()).toMatchObject({
      evaluated: 1,
      triggered: 0,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
