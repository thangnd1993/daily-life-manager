import { Module } from '@nestjs/common';
import {
  AdminFinanceController,
  AdminFinanceInsightsController,
  FinanceController,
} from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  controllers: [
    FinanceController,
    AdminFinanceController,
    AdminFinanceInsightsController,
  ],
  providers: [FinanceService],
})
export class FinanceModule {}
