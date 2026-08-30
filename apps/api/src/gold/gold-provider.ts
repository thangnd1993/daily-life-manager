import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NormalizedGoldPrice {
  provider: string;
  productCode: string;
  productName: string;
  buyPrice: bigint;
  sellPrice: bigint;
  currency: 'VND';
  unit: 'LUONG';
  sourceTimestamp: Date;
}

export interface GoldPriceProvider {
  readonly id: string;
  fetchLatest(): Promise<NormalizedGoldPrice[]>;
}

type PhaBrand = { name?: unknown; buy?: unknown; sell?: unknown };
type PhaResponse = {
  status?: unknown;
  unit?: unknown;
  updatedAt?: unknown;
  timestamp?: unknown;
  brands?: unknown;
};

@Injectable()
export class PhaGoldPriceProvider implements GoldPriceProvider {
  readonly id = 'pha';
  private readonly products: Record<string, { code: string; name: string }> = {
    sjc: { code: 'SJC', name: 'SJC Gold' },
    doji: { code: 'DOJI', name: 'DOJI Gold' },
    pnj: { code: 'PNJ', name: 'PNJ Gold' },
  };

  constructor(private readonly config: ConfigService) {}

  async fetchLatest(): Promise<NormalizedGoldPrice[]> {
    const apiKey = this.config.get<string>('GOLD_PROVIDER_API_KEY');
    if (!apiKey)
      throw new ServiceUnavailableException(
        'Gold provider API key is not configured',
      );
    const baseUrl = this.config.get<string>(
      'GOLD_PROVIDER_BASE_URL',
      'https://www.pha.vn/api/v1',
    );
    const timeout = this.config.get<number>('GOLD_PROVIDER_TIMEOUT_MS', 5000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${baseUrl}/gold-prices?brand=all`, {
        headers: { 'x-api-key': apiKey, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok)
        throw new ServiceUnavailableException(
          `Gold provider request failed (${response.status})`,
        );
      return this.normalize((await response.json()) as PhaResponse, new Date());
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Gold provider is unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  normalize(payload: PhaResponse, fetchedAt: Date): NormalizedGoldPrice[] {
    if (
      payload.status !== 'success' ||
      payload.unit !== 'VND/luong' ||
      !Array.isArray(payload.brands)
    ) {
      throw new ServiceUnavailableException(
        'Gold provider returned malformed data',
      );
    }
    const sourceTimestamp = this.timestamp(
      payload.updatedAt ?? payload.timestamp,
      fetchedAt,
    );
    return (payload.brands as PhaBrand[]).flatMap((brand) => {
      const key =
        typeof brand.name === 'string' ? brand.name.trim().toLowerCase() : '';
      const product = this.products[key];
      const buy = this.positiveInteger(brand.buy);
      const sell = this.positiveInteger(brand.sell);
      if (!product || buy === null || sell === null) return [];
      return [
        {
          provider: this.id,
          productCode: product.code,
          productName: product.name,
          buyPrice: buy,
          sellPrice: sell,
          currency: 'VND' as const,
          unit: 'LUONG' as const,
          sourceTimestamp,
        },
      ];
    });
  }

  private positiveInteger(value: unknown): bigint | null {
    if (
      (typeof value !== 'number' && typeof value !== 'string') ||
      !/^\d+$/.test(String(value))
    )
      return null;
    const result = BigInt(value);
    return result > 0n ? result : null;
  }

  private timestamp(value: unknown, fallback: Date): Date {
    const normalized =
      typeof value === 'number' && value < 1_000_000_000_000
        ? value * 1000
        : value;
    const parsed =
      typeof normalized === 'string' || typeof normalized === 'number'
        ? new Date(normalized)
        : fallback;
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }
}
