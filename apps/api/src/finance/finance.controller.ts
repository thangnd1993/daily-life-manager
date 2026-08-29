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
import {
  BudgetMonthQueryDto,
  CreateCategoryDto,
  CreateTransactionDto,
  TransactionQueryDto,
  UpdateBudgetDto,
  UpdateCategoryDto,
  UpdateTransactionDto,
  UpsertBudgetDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List system and personal transaction categories' })
  categories(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.categories(user.id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a personal transaction category' })
  createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.finance.createCategory(user.id, dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Rename an owned personal category' })
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.finance.updateCategory(user.id, id, dto.name);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused owned personal category' })
  deleteCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.finance.deleteCategory(user.id, id);
  }

  @Get('transactions')
  @ApiOperation({ summary: "List the current user's monthly transactions" })
  transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionQueryDto,
  ) {
    return this.finance.transactions(user.id, query);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Create a finance transaction' })
  createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.finance.createTransaction(user.id, dto);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get an owned finance transaction' })
  transaction(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.finance.transaction(user.id, id);
  }

  @Patch('transactions/:id')
  @ApiOperation({ summary: 'Update an owned finance transaction' })
  updateTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.finance.updateTransaction(user.id, id, dto);
  }

  @Delete('transactions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an owned finance transaction' })
  deleteTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.finance.deleteTransaction(user.id, id);
  }

  @Get('summary')
  @ApiOperation({ summary: "Get the current user's monthly finance summary" })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionQueryDto,
  ) {
    return this.finance.summary(user.id, query.year, query.month);
  }

  @Get('budgets')
  @ApiOperation({ summary: "Get the current user's monthly budgets and usage" })
  budgets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BudgetMonthQueryDto,
  ) {
    return this.finance.budgets(user.id, query);
  }

  @Post('budgets')
  @ApiOperation({
    summary: 'Create or replace an overall or category monthly budget',
  })
  upsertBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertBudgetDto,
  ) {
    return this.finance.upsertBudget(user.id, dto);
  }

  @Patch('budgets/:id')
  @ApiOperation({ summary: 'Update an owned monthly budget' })
  updateBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.finance.updateBudget(user.id, id, dto.amount);
  }

  @Delete('budgets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an owned monthly budget' })
  deleteBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.finance.deleteBudget(user.id, id);
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Get monthly category spending and a six-month trend',
  })
  analytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BudgetMonthQueryDto,
  ) {
    return this.finance.analytics(user.id, query.year, query.month);
  }
}

@ApiTags('admin finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users/:id/transactions')
export class AdminFinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @ApiOperation({
    summary: "Inspect a selected user's monthly finance transactions",
  })
  transactions(@Param('id') id: string, @Query() query: TransactionQueryDto) {
    return this.finance.adminTransactions(id, query);
  }
}

@ApiTags('admin finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users/:id/finance-insights')
export class AdminFinanceInsightsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @ApiOperation({
    summary: "Inspect a selected user's monthly budgets and analytics",
  })
  insights(@Param('id') id: string, @Query() query: BudgetMonthQueryDto) {
    return this.finance.adminInsights(id, query);
  }
}
