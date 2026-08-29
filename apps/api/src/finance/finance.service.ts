import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  BudgetMonthQueryDto,
  CreateCategoryDto,
  CreateTransactionDto,
  TransactionQueryDto,
  UpsertBudgetDto,
  UpdateTransactionDto,
} from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  categories(userId: string) {
    return this.prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(userId: string, dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const duplicate = await this.prisma.transactionCategory.findFirst({
      where: {
        userId,
        type: dto.type,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (duplicate) throw new ConflictException('Category already exists');
    return this.prisma.transactionCategory.create({
      data: { userId, name, type: dto.type },
    });
  }

  async updateCategory(userId: string, id: string, nameValue: string) {
    const category = await this.ownedCategory(userId, id);
    const name = nameValue.trim();
    const duplicate = await this.prisma.transactionCategory.findFirst({
      where: {
        userId,
        type: category.type,
        name: { equals: name, mode: 'insensitive' },
        id: { not: id },
      },
    });
    if (duplicate) throw new ConflictException('Category already exists');
    return this.prisma.transactionCategory.update({
      where: { id },
      data: { name },
    });
  }

  async deleteCategory(userId: string, id: string): Promise<void> {
    await this.ownedCategory(userId, id);
    if (
      await this.prisma.financeTransaction.count({ where: { categoryId: id } })
    ) {
      throw new ConflictException('Category is used by transactions');
    }
    if (await this.prisma.financeBudget.count({ where: { categoryId: id } })) {
      throw new ConflictException('Category is used by budgets');
    }
    await this.prisma.transactionCategory.delete({ where: { id } });
  }

  async createTransaction(userId: string, dto: CreateTransactionDto) {
    await this.usableCategory(userId, dto.categoryId, dto.type);
    const transaction = await this.prisma.financeTransaction.create({
      data: {
        userId,
        type: dto.type,
        amount: BigInt(dto.amount),
        currency: dto.currency,
        categoryId: dto.categoryId,
        description: dto.description?.trim() || null,
        occurredAt: new Date(dto.occurredAt),
      },
      include: { category: true },
    });
    return this.safeTransaction(transaction);
  }

  async transactions(userId: string, query: TransactionQueryDto) {
    const where = this.transactionWhere(userId, query);
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.financeTransaction.findMany({
        where,
        include: { category: true },
        orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.financeTransaction.count({ where }),
    ]);
    return {
      items: items.map((item) => this.safeTransaction(item)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    };
  }

  async transaction(userId: string, id: string) {
    const item = await this.prisma.financeTransaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!item) throw new NotFoundException('Transaction not found');
    return this.safeTransaction(item);
  }

  async updateTransaction(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ) {
    const existing = await this.prisma.financeTransaction.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Transaction not found');
    const type = dto.type ?? existing.type;
    const categoryId = dto.categoryId ?? existing.categoryId;
    await this.usableCategory(userId, categoryId, type);
    const item = await this.prisma.financeTransaction.update({
      where: { id },
      data: {
        type: dto.type,
        amount: dto.amount ? BigInt(dto.amount) : undefined,
        currency: dto.currency,
        categoryId: dto.categoryId,
        description:
          dto.description === undefined
            ? undefined
            : dto.description.trim() || null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
      include: { category: true },
    });
    return this.safeTransaction(item);
  }

  async deleteTransaction(userId: string, id: string): Promise<void> {
    const result = await this.prisma.financeTransaction.deleteMany({
      where: { id, userId },
    });
    if (result.count !== 1)
      throw new NotFoundException('Transaction not found');
  }

  async summary(userId: string, year: number, month: number) {
    const query = Object.assign(new TransactionQueryDto(), { year, month });
    const groups = await this.prisma.financeTransaction.groupBy({
      by: ['type'],
      where: this.transactionWhere(userId, query),
      _sum: { amount: true },
    });
    const total = (type: FinanceTransactionType) =>
      groups.find((group) => group.type === type)?._sum.amount ?? 0n;
    const income = total(FinanceTransactionType.INCOME);
    const expense = total(FinanceTransactionType.EXPENSE);
    return {
      year,
      month,
      currency: 'VND',
      totalIncome: income.toString(),
      totalExpense: expense.toString(),
      netBalance: (income - expense).toString(),
    };
  }

  async adminTransactions(userId: string, query: TransactionQueryDto) {
    if ((await this.prisma.user.count({ where: { id: userId } })) !== 1) {
      throw new NotFoundException('User not found');
    }
    const [page, summary] = await Promise.all([
      this.transactions(userId, query),
      this.summary(userId, query.year, query.month),
    ]);
    return { ...page, summary };
  }

  async budgets(userId: string, query: BudgetMonthQueryDto) {
    const [budgets, spending] = await Promise.all([
      this.prisma.financeBudget.findMany({
        where: { userId, year: query.year, month: query.month },
        include: { category: true },
        orderBy: [{ categoryId: 'asc' }],
      }),
      this.expenseGroups(userId, query.year, query.month),
    ]);
    const allSpent = spending.reduce(
      (total, group) => total + (group._sum.amount ?? 0n),
      0n,
    );
    return budgets.map((budget) => {
      const spent = budget.categoryId
        ? (spending.find((group) => group.categoryId === budget.categoryId)
            ?._sum.amount ?? 0n)
        : allSpent;
      return this.budgetUsage(budget, spent);
    });
  }

  async upsertBudget(userId: string, dto: UpsertBudgetDto) {
    if (dto.categoryId) {
      await this.usableCategory(
        userId,
        dto.categoryId,
        FinanceTransactionType.EXPENSE,
      );
    }
    const where = {
      userId,
      year: dto.year,
      month: dto.month,
      categoryId: dto.categoryId ?? null,
    };
    const existing = await this.prisma.financeBudget.findFirst({ where });
    const data = { amount: BigInt(dto.amount), currency: dto.currency };
    const budget = existing
      ? await this.prisma.financeBudget.update({
          where: { id: existing.id },
          data,
          include: { category: true },
        })
      : await this.prisma.financeBudget.create({
          data: { ...where, ...data },
          include: { category: true },
        });
    const usage = await this.budgets(userId, dto);
    return usage.find((item) => item.id === budget.id);
  }

  async updateBudget(userId: string, id: string, amount: string) {
    const existing = await this.prisma.financeBudget.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Budget not found');
    await this.prisma.financeBudget.update({
      where: { id },
      data: { amount: BigInt(amount) },
    });
    return (await this.budgets(userId, existing)).find(
      (item) => item.id === id,
    );
  }

  async deleteBudget(userId: string, id: string): Promise<void> {
    const result = await this.prisma.financeBudget.deleteMany({
      where: { id, userId },
    });
    if (result.count !== 1) throw new NotFoundException('Budget not found');
  }

  async analytics(userId: string, year: number, month: number) {
    const [summary, groups, trend] = await Promise.all([
      this.summary(userId, year, month),
      this.expenseGroups(userId, year, month),
      Promise.all(
        Array.from({ length: 6 }, (_, offset) => {
          const date = new Date(Date.UTC(year, month - 1 - (5 - offset), 1));
          return this.summary(
            userId,
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
          );
        }),
      ),
    ]);
    const categoryIds = groups.map((group) => group.categoryId);
    const categories = await this.prisma.transactionCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    const totalExpense = BigInt(summary.totalExpense);
    return {
      ...summary,
      expenseByCategory: groups
        .map((group) => {
          const amount = group._sum.amount ?? 0n;
          return {
            category: categories.find(
              (category) => category.id === group.categoryId,
            ),
            amount: amount.toString(),
            percentage:
              totalExpense === 0n
                ? 0
                : Number((amount * 1000n) / totalExpense) / 10,
          };
        })
        .sort((left, right) => {
          const difference = BigInt(right.amount) - BigInt(left.amount);
          return difference > 0n ? 1 : difference < 0n ? -1 : 0;
        }),
      trend,
    };
  }

  async adminInsights(userId: string, query: BudgetMonthQueryDto) {
    if ((await this.prisma.user.count({ where: { id: userId } })) !== 1) {
      throw new NotFoundException('User not found');
    }
    const [budgets, analytics] = await Promise.all([
      this.budgets(userId, query),
      this.analytics(userId, query.year, query.month),
    ]);
    return { budgets, analytics };
  }

  private async ownedCategory(userId: string, id: string) {
    const category = await this.prisma.transactionCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category.userId !== userId)
      throw new ForbiddenException('Category is read-only');
    return category;
  }

  private async usableCategory(
    userId: string,
    id: string,
    type: FinanceTransactionType,
  ) {
    const category = await this.prisma.transactionCategory.findFirst({
      where: { id, type, OR: [{ userId: null }, { userId }] },
    });
    if (!category) throw new ForbiddenException('Category is not available');
    return category;
  }

  private transactionWhere(
    userId: string,
    query: TransactionQueryDto,
  ): Prisma.FinanceTransactionWhereInput {
    const start = new Date(Date.UTC(query.year, query.month - 1, 1));
    const end = new Date(Date.UTC(query.year, query.month, 1));
    return {
      userId,
      occurredAt: { gte: start, lt: end },
      type: query.type,
      categoryId: query.categoryId,
      description: query.search
        ? { contains: query.search.trim(), mode: 'insensitive' }
        : undefined,
    };
  }

  private expenseGroups(userId: string, year: number, month: number) {
    const query = Object.assign(new TransactionQueryDto(), {
      year,
      month,
      type: FinanceTransactionType.EXPENSE,
    });
    return this.prisma.financeTransaction.groupBy({
      by: ['categoryId'],
      where: this.transactionWhere(userId, query),
      _sum: { amount: true },
    });
  }

  private budgetUsage<T extends { amount: bigint }>(budget: T, spent: bigint) {
    const remaining = budget.amount - spent;
    return {
      ...budget,
      amount: budget.amount.toString(),
      spentAmount: spent.toString(),
      remainingAmount: remaining.toString(),
      percentageUsed: Number((spent * 1000n) / budget.amount) / 10,
      exceeded: spent > budget.amount,
    };
  }

  private safeTransaction<T extends { amount: bigint }>(
    transaction: T,
  ): Omit<T, 'amount'> & { amount: string } {
    return { ...transaction, amount: transaction.amount.toString() };
  }
}
