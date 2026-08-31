import { Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationJobsService } from './notification-jobs.service';
import { NotificationsService } from './notifications.service';
import { PushController } from './push.controller';
import { PushDevicesService } from './push-devices.service';

@Module({
  controllers: [PushController],
  providers: [
    PushDevicesService,
    FcmService,
    NotificationDeliveryService,
    NotificationJobsService,
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class PushModule {}
