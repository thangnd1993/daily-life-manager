import { Module } from '@nestjs/common';
import {
  AdminAttendanceController,
  AttendanceController,
} from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  controllers: [AttendanceController, AdminAttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
