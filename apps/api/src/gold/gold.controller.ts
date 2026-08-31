import {
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { GoldHistoryQueryDto } from './dto/gold.dto';
import { GoldService } from './gold.service';

@ApiTags('gold prices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gold/prices')
export class GoldController {
  constructor(private readonly gold: GoldService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the latest stored gold price for each supported product',
  })
  latest() {
    return this.gold.latest();
  }

  @Get(':productCode/history')
  @ApiOperation({
    summary: 'Get bounded recent history for a supported gold product',
  })
  history(
    @Param('productCode') productCode: string,
    @Query() query: GoldHistoryQueryDto,
  ) {
    return this.gold.history(productCode, query.days, query.limit);
  }
}

@ApiTags('admin gold prices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/gold')
export class AdminGoldController {
  constructor(
    private readonly gold: GoldService,
    private readonly audit: AuditService,
  ) {}

  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Fetch, validate, and persist the latest provider prices',
  })
  async refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    try {
      const result = await this.gold.refresh();
      await this.audit.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'ADMIN_GOLD_REFRESH',
        targetType: 'GOLD_PROVIDER',
        outcome: AuditOutcome.SUCCESS,
        metadata: { snapshotCount: result.length },
        context: auditContext(request),
      });
      return result;
    } catch (error) {
      await this.audit.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'ADMIN_GOLD_REFRESH',
        targetType: 'GOLD_PROVIDER',
        outcome: AuditOutcome.FAILURE,
        context: auditContext(request),
      });
      throw error;
    }
  }
}
