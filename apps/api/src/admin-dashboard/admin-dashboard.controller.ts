import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  AdminDashboardSummary,
  AdminDashboardTrends,
} from './admin-dashboard.types';

@ApiTags('admin dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get ADMIN-only bounded account and operational aggregates',
  })
  @ApiOkResponse({
    description: 'Current dashboard summary with no private record details',
  })
  summary(): Promise<AdminDashboardSummary> {
    return this.dashboard.summary();
  }

  @Get('trends')
  @ApiOperation({
    summary: 'Get ADMIN-only seven-day trends and safe recent activity',
  })
  @ApiOkResponse({
    description: 'Seven-day daily series and bounded recent activity',
  })
  trends(): Promise<AdminDashboardTrends> {
    return this.dashboard.trends();
  }
}
