import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Currency, FinanceTransactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BudgetMonthQueryDto, TransactionQueryDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  const prisma = {
    transactionCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    financeTransaction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    financeBudget: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    user: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: FinanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinanceService(prisma as unknown as PrismaService);
  });

  it('lists only default and current-user categories', async () => {
    prisma.transactionCategory.findMany.mockResolvedValue([]);
    await service.categories('user-1');
    expect(prisma.transactionCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ userId: null }, { userId: 'user-1' }] },
      }),
    );
  });

  it('rejects duplicate personal categories and mutations of defaults', async () => {
    prisma.transactionCategory.findFirst.mockResolvedValue({ id: 'duplicate' });
    await expect(
      service.createCategory('user-1', {
        name: ' Food ',
        type: FinanceTransactionType.EXPENSE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.transactionCategory.findUnique.mockResolvedValue({
      id: 'system',
      userId: null,
      type: FinanceTransactionType.EXPENSE,
    });
    await expect(
      service.updateCategory('user-1', 'system', 'Meals'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects deleting a referenced personal category', async () => {
    prisma.transactionCategory.findUnique.mockResolvedValue({
      id: 'personal',
      userId: 'user-1',
    });
    prisma.financeTransaction.count.mockResolvedValue(1);
    await expect(
      service.deleteCategory('user-1', 'personal'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates an owned transaction with BigInt storage and string serialization', async () => {
    prisma.transactionCategory.findFirst.mockResolvedValue({ id: 'food' });
    prisma.financeTransaction.create.mockResolvedValue({
      id: 'tx-1',
      amount: 150000n,
      category: { id: 'food' },
    });
    const result = await service.createTransaction('user-1', {
      type: FinanceTransactionType.EXPENSE,
      amount: '150000',
      currency: Currency.VND,
      categoryId: 'food',
      occurredAt: '2026-08-30T00:00:00.000Z',
    });
    expect(result.amount).toBe('150000');
    expect(prisma.financeTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', amount: 150000n }),
      }),
    );
  });

  it('rejects unavailable or wrong-type categories', async () => {
    prisma.transactionCategory.findFirst.mockResolvedValue(null);
    await expect(
      service.createTransaction('user-1', {
        type: FinanceTransactionType.INCOME,
        amount: '1',
        currency: Currency.VND,
        categoryId: 'another-users-category',
        occurredAt: '2026-08-30T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filters transaction history by owner and UTC calendar month', async () => {
    prisma.financeTransaction.findMany.mockReturnValue('items-query');
    prisma.financeTransaction.count.mockReturnValue('count-query');
    prisma.$transaction.mockResolvedValue([[{ id: 'tx-1', amount: 25n }], 1]);
    const query = Object.assign(new TransactionQueryDto(), {
      year: 2026,
      month: 8,
    });
    const result = await service.transactions('user-1', query);
    expect(result.items[0].amount).toBe('25');
    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          occurredAt: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lt: new Date('2026-09-01T00:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('returns not found instead of exposing another user transaction', async () => {
    prisma.financeTransaction.findFirst.mockResolvedValue(null);
    await expect(
      service.transaction('user-1', 'tx-other'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('summarizes income, expense, and signed net as decimal strings', async () => {
    prisma.financeTransaction.groupBy.mockResolvedValue([
      { type: FinanceTransactionType.INCOME, _sum: { amount: 1000n } },
      { type: FinanceTransactionType.EXPENSE, _sum: { amount: 400n } },
    ]);
    await expect(service.summary('user-1', 2026, 8)).resolves.toMatchObject({
      totalIncome: '1000',
      totalExpense: '400',
      netBalance: '600',
      currency: 'VND',
    });
  });

  it('rejects selected-user inspection when the user does not exist', async () => {
    prisma.user.count.mockResolvedValue(0);
    await expect(
      service.adminTransactions('missing', new TransactionQueryDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('calculates overall and category budget usage without floating-point money', async () => {
    prisma.financeBudget.findMany.mockResolvedValue([
      { id: 'overall', categoryId: null, amount: 1000n },
      { id: 'food-budget', categoryId: 'food', amount: 300n },
    ]);
    prisma.financeTransaction.groupBy.mockResolvedValue([
      { categoryId: 'food', _sum: { amount: 400n } },
    ]);
    const result = await service.budgets(
      'user-1',
      Object.assign(new BudgetMonthQueryDto(), { year: 2026, month: 8 }),
    );
    expect(result[0]).toMatchObject({
      amount: '1000',
      spentAmount: '400',
      remainingAmount: '600',
      exceeded: false,
    });
    expect(result[1]).toMatchObject({
      amount: '300',
      spentAmount: '400',
      remainingAmount: '-100',
      exceeded: true,
    });
  });

  it('upserts an overall budget for only the authenticated owner', async () => {
    prisma.financeBudget.findFirst.mockResolvedValue({ id: 'budget-1' });
    prisma.financeBudget.update.mockResolvedValue({
      id: 'budget-1',
      amount: 5000n,
    });
    prisma.financeBudget.findMany.mockResolvedValue([
      { id: 'budget-1', categoryId: null, amount: 5000n },
    ]);
    prisma.financeTransaction.groupBy.mockResolvedValue([]);
    await service.upsertBudget('user-1', {
      year: 2026,
      month: 8,
      amount: '5000',
      currency: Currency.VND,
    });
    expect(prisma.financeBudget.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', year: 2026, month: 8, categoryId: null },
    });
    expect(prisma.financeBudget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { amount: 5000n, currency: Currency.VND },
      }),
    );
  });

  it('rejects a foreign private category for category budgets', async () => {
    prisma.transactionCategory.findFirst.mockResolvedValue(null);
    await expect(
      service.upsertBudget('user-1', {
        year: 2026,
        month: 8,
        amount: '5000',
        currency: Currency.VND,
        categoryId: 'foreign',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not update or delete another user budget', async () => {
    prisma.financeBudget.findFirst.mockResolvedValue(null);
    prisma.financeBudget.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      service.updateBudget('user-1', 'foreign', '1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.deleteBudget('user-1', 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns category analytics sorted by spend and an oldest-to-current six-month trend', async () => {
    prisma.financeTransaction.groupBy
      .mockResolvedValueOnce([
        { type: FinanceTransactionType.EXPENSE, _sum: { amount: 1000n } },
      ])
      .mockResolvedValueOnce([
        { categoryId: 'food', _sum: { amount: 750n } },
        { categoryId: 'bills', _sum: { amount: 250n } },
      ])
      .mockResolvedValue([]);
    prisma.transactionCategory.findMany.mockResolvedValue([
      { id: 'food', name: 'Food' },
      { id: 'bills', name: 'Bills' },
    ]);
    const result = await service.analytics('user-1', 2026, 8);
    expect(result.expenseByCategory[0]).toMatchObject({
      amount: '750',
      percentage: 75,
    });
    expect(result.trend).toHaveLength(6);
    expect(result.trend[0]).toMatchObject({ year: 2026, month: 3 });
    expect(result.trend[5]).toMatchObject({ year: 2026, month: 8 });
  });
});
