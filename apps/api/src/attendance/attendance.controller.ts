import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AttendanceService } from './attendance.service';
import {
  AttendanceHistoryQueryDto,
  CheckInDto,
  LeaveModeDto,
  TimezoneQueryDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('today')
  @ApiOperation({
    summary: "Get the current user's local-date attendance state",
  })
  today(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TimezoneQueryDto,
  ) {
    return this.attendance.today(user.id, query.timezone);
  }

  @Post('check-in')
  @ApiOperation({
    summary: 'Check in once for the current local calendar date',
  })
  checkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.attendance.checkIn(user.id, dto.timezone, dto.note);
  }

  @Get()
  @ApiOperation({
    summary: "Get the current user's monthly attendance history",
  })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AttendanceHistoryQueryDto,
  ) {
    return this.attendance.history(user.id, query);
  }

  @Patch('leave-mode')
  setLeaveMode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LeaveModeDto,
  ) {
    return this.attendance.setLeaveMode(user.id, dto.enabled, dto.reason);
  }

  @Put(':date')
  @ApiOperation({
    summary: 'Create or update an owner-scoped attendance day',
    description:
      'Uses YYYY-MM-DD. Authenticated owners may upsert today or a past date in their configured attendance timezone; future dates are rejected.',
  })
  updateDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date') date: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendance.updateDay(user.id, date, dto);
  }

  @Patch(':date')
  @ApiOperation({ summary: 'Legacy alias for owner-scoped attendance upsert' })
  updateDayLegacy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date') date: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendance.updateDay(user.id, date, dto);
  }
}

@ApiTags('admin attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users/:id/attendance')
export class AdminAttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  @ApiOperation({ summary: "Inspect a selected user's monthly attendance" })
  history(@Param('id') id: string, @Query() query: AttendanceHistoryQueryDto) {
    return this.attendance.adminHistory(id, query);
  }
}
