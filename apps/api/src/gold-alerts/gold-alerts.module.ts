import { Module } from '@nestjs/common';
import { GoldModule } from '../gold/gold.module';
import { GoldAlertJobsService } from './gold-alert-jobs.service';
import {
  AdminGoldAlertsController,
  GoldAlertsController,
} from './gold-alerts.controller';
import { GoldAlertsService } from './gold-alerts.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [GoldModule, PushModule],
  controllers: [GoldAlertsController, AdminGoldAlertsController],
  providers: [GoldAlertsService, GoldAlertJobsService],
})
export class GoldAlertsModule {}
