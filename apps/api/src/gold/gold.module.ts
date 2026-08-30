import { Module } from '@nestjs/common';
import { AdminGoldController, GoldController } from './gold.controller';
import { PhaGoldPriceProvider } from './gold-provider';
import { GoldService } from './gold.service';

@Module({
  controllers: [GoldController, AdminGoldController],
  providers: [
    PhaGoldPriceProvider,
    { provide: 'GoldPriceProvider', useExisting: PhaGoldPriceProvider },
    GoldService,
  ],
  exports: [GoldService],
})
export class GoldModule {}
