import { createHash } from 'crypto';
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GoldPriceProvider, NormalizedGoldPrice } from './gold-provider';

@Injectable()
export class GoldService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('GoldPriceProvider') private readonly provider: GoldPriceProvider,
  ) {}

  async refresh() {
    const prices = await this.provider.fetchLatest();
    if (!prices.length)
      throw new ServiceUnavailableException(
        'Gold provider returned no supported products',
      );
    const fetchedAt = new Date();
    await this.prisma.goldPriceSnapshot.createMany({
      data: prices.map((price) => ({
        ...price,
        fetchedAt,
        fingerprint: this.fingerprint(price),
      })),
      skipDuplicates: true,
    });
    return this.latest();
  }

  async latest() {
    const items = await this.prisma.goldPriceSnapshot.findMany({
      orderBy: [{ sourceTimestamp: 'desc' }, { productCode: 'asc' }],
      distinct: ['productCode'],
    });
    return items.map((item) => this.safe(item));
  }

  async history(productCodeValue: string, days: number, limit: number) {
    const productCode = productCodeValue.trim().toUpperCase();
    const since = new Date(Date.now() - days * 86_400_000);
    const items = await this.prisma.goldPriceSnapshot.findMany({
      where: { productCode, sourceTimestamp: { gte: since } },
      orderBy: [{ sourceTimestamp: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    if (!items.length)
      throw new NotFoundException('Gold product history not found');
    return { productCode, days, items: items.map((item) => this.safe(item)) };
  }

  private fingerprint(price: NormalizedGoldPrice): string {
    return createHash('sha256')
      .update(
        [
          price.provider,
          price.productCode,
          price.buyPrice,
          price.sellPrice,
          price.unit,
        ].join('|'),
      )
      .digest('hex');
  }

  private safe<
    T extends {
      buyPrice: bigint;
      sellPrice: bigint;
      sourceTimestamp: Date;
      fetchedAt: Date;
    },
  >(item: T) {
    const ageSeconds = Math.max(
      0,
      Math.floor((Date.now() - item.sourceTimestamp.getTime()) / 1000),
    );
    return {
      ...item,
      buyPrice: item.buyPrice.toString(),
      sellPrice: item.sellPrice.toString(),
      ageSeconds,
      stale: ageSeconds > 3600,
    };
  }
}
