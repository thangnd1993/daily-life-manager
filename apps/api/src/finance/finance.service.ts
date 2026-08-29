import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CreateCategoryDto,
  CreateTransactionDto,
  TransactionQueryDto,
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

  private safeTransaction<T extends { amount: bigint }>(
    transaction: T,
  ): Omit<T, 'amount'> & { amount: string } {
    return { ...transaction, amount: transaction.amount.toString() };
  }
}
