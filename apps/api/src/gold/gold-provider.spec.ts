import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhaGoldPriceProvider } from './gold-provider';

describe('PhaGoldPriceProvider', () => {
  const provider = new PhaGoldPriceProvider({
    get: jest.fn(),
  } as unknown as ConfigService);

  it('normalizes only supported products without leaking provider shape', () => {
    const result = provider.normalize(
      {
        status: 'success',
        unit: 'VND/luong',
        updatedAt: '2026-08-30T00:00:00Z',
        brands: [
          {
            name: 'SJC',
            buy: 88500000,
            sell: '90500000',
            ignored: 'provider-only',
          },
          { name: 'Unknown', buy: 1, sell: 2 },
        ],
      } as never,
      new Date(),
    );
    expect(result).toEqual([
      {
        provider: 'pha',
        productCode: 'SJC',
        productName: 'SJC Gold',
        buyPrice: 88500000n,
        sellPrice: 90500000n,
        currency: 'VND',
        unit: 'LUONG',
        sourceTimestamp: new Date('2026-08-30T00:00:00Z'),
      },
    ]);
    expect(result[0]).not.toHaveProperty('ignored');
  });

  it('rejects malformed and non-positive prices', () => {
    expect(() =>
      provider.normalize({ status: 'failed', brands: [] }, new Date()),
    ).toThrow(ServiceUnavailableException);
    const result = provider.normalize(
      {
        status: 'success',
        unit: 'VND/luong',
        brands: [{ name: 'SJC', buy: -1, sell: 2 }],
      },
      new Date(),
    );
    expect(result).toEqual([]);
  });
});
