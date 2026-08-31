import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditOutcome, UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { auditContext } from '../audit/audit.types';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateGoldAlertDto,
  SetGoldAlertEnabledDto,
  UpdateGoldAlertDto,
} from './dto/gold-alert.dto';
import { GoldAlertJobsService } from './gold-alert-jobs.service';
import { GoldAlertsService } from './gold-alerts.service';

@ApiTags('gold alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gold/alerts')
export class GoldAlertsController {
  constructor(private readonly alerts: GoldAlertsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's gold alerts" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.alerts.list(user.id);
  }

  @Get('triggers')
  @ApiOperation({ summary: "List the current user's recent alert triggers" })
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.alerts.history(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a gold alert' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoldAlertDto,
  ) {
    return this.alerts.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an owned gold alert' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGoldAlertDto,
  ) {
    return this.alerts.update(user.id, id, dto);
  }

  @Patch(':id/enabled')
  @ApiOperation({ summary: 'Enable or disable an owned gold alert' })
  setEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetGoldAlertEnabledDto,
  ) {
    return this.alerts.setEnabled(user.id, id, dto.isEnabled);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an owned gold alert' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.alerts.remove(user.id, id);
  }
}

@ApiTags('admin gold alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/gold/alerts')
export class AdminGoldAlertsController {
  constructor(
    private readonly jobs: GoldAlertJobsService,
    private readonly audit: AuditService,
  ) {}

  @Post('evaluate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Queue a global gold price refresh and evaluation' })
  async evaluate(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    try {
      const result = await this.jobs.enqueueManual();
      await this.audit.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'ADMIN_GOLD_EVALUATION_QUEUED',
        targetType: 'GOLD_ALERT_JOB',
        outcome: AuditOutcome.SUCCESS,
        context: auditContext(request),
      });
      return result;
    } catch (error) {
      await this.audit.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'ADMIN_GOLD_EVALUATION_QUEUED',
        targetType: 'GOLD_ALERT_JOB',
        outcome: AuditOutcome.FAILURE,
        context: auditContext(request),
      });
      throw error;
    }
  }
}
