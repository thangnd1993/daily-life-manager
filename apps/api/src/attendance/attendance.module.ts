import { Module } from '@nestjs/common';
import {
  AdminAttendanceController,
  AttendanceController,
} from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceJobsService } from './attendance-jobs.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule],
  controllers: [AttendanceController, AdminAttendanceController],
  providers: [AttendanceService, AttendanceJobsService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
