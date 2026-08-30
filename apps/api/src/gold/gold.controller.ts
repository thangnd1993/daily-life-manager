import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
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
  constructor(private readonly gold: GoldService) {}

  @Post('refresh')
  @ApiOperation({
    summary: 'Fetch, validate, and persist the latest provider prices',
  })
  refresh() {
    return this.gold.refresh();
  }
}
