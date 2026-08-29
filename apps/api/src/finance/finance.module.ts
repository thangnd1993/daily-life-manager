import { Module } from '@nestjs/common';
import {
  AdminFinanceController,
  FinanceController,
} from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  controllers: [FinanceController, AdminFinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
