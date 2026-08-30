import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GoldPriceProvider } from './gold-provider';
import { GoldService } from './gold.service';

describe('GoldService', () => {
  const prisma = {
    goldPriceSnapshot: { createMany: jest.fn(), findMany: jest.fn() },
  };
  const provider: GoldPriceProvider = { id: 'test', fetchLatest: jest.fn() };
  let service: GoldService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GoldService(prisma as unknown as PrismaService, provider);
  });

  it('persists normalized snapshots with deterministic deduplication fingerprints', async () => {
    const price = {
      provider: 'test',
      productCode: 'SJC',
      productName: 'SJC Gold',
      buyPrice: 1n,
      sellPrice: 2n,
      currency: 'VND' as const,
      unit: 'LUONG' as const,
      sourceTimestamp: new Date('2026-08-30T00:00:00Z'),
    };
    (provider.fetchLatest as jest.Mock).mockResolvedValue([price]);
    prisma.goldPriceSnapshot.createMany.mockResolvedValue({ count: 1 });
    prisma.goldPriceSnapshot.findMany.mockResolvedValue([]);
    await service.refresh();
    const first = prisma.goldPriceSnapshot.createMany.mock.calls[0][0];
    expect(first.skipDuplicates).toBe(true);
    expect(first.data[0]).toMatchObject({
      buyPrice: 1n,
      sellPrice: 2n,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    await service.refresh();
    expect(
      prisma.goldPriceSnapshot.createMany.mock.calls[1][0].data[0].fingerprint,
    ).toBe(first.data[0].fingerprint);
  });

  it('keeps stored latest data independent from provider failures and serializes BigInt', async () => {
    prisma.goldPriceSnapshot.findMany.mockResolvedValue([
      {
        id: 'snapshot-1',
        buyPrice: 88500000n,
        sellPrice: 90500000n,
        productCode: 'SJC',
        sourceTimestamp: new Date(),
        fetchedAt: new Date(),
      },
    ]);
    (provider.fetchLatest as jest.Mock).mockRejectedValue(
      new ServiceUnavailableException(),
    );
    await expect(service.refresh()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.latest()).resolves.toEqual([
      expect.objectContaining({ buyPrice: '88500000', sellPrice: '90500000' }),
    ]);
  });

  it('returns chronological bounded history and rejects unknown products', async () => {
    prisma.goldPriceSnapshot.findMany
      .mockResolvedValueOnce([
        {
          id: 'one',
          buyPrice: 1n,
          sellPrice: 2n,
          sourceTimestamp: new Date(),
          fetchedAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([]);
    await expect(service.history('sjc', 7, 50)).resolves.toMatchObject({
      productCode: 'SJC',
      days: 7,
    });
    expect(prisma.goldPriceSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productCode: 'SJC' }),
        take: 50,
        orderBy: [{ sourceTimestamp: 'asc' }, { id: 'asc' }],
      }),
    );
    await expect(service.history('unknown', 7, 50)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
