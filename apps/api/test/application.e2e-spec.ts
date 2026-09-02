import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Currency,
  FinanceTransactionType,
  GoldAlertCondition,
  GoldAlertPriceSide,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { GoldAlertsService } from '../src/gold-alerts/gold-alerts.service';

const strongPassword = 'Strong!Password123';
const newPassword = 'New!StrongPassword456';

describe('critical application journeys (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        displayName: 'Administrator',
        passwordHash: await argon2.hash(strongPassword),
        role: UserRole.ADMIN,
      },
    });
    adminToken = (await login('admin@example.com', strongPassword)).accessToken;
  });

  afterAll(async () => app.close());

  it('covers registration, login, profile, refresh rotation, password change, logout, and audit', async () => {
    const registered = await register('lifecycle@example.com');
    const firstProfile = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(registered.accessToken))
      .expect(200);
    expect(firstProfile.body).toMatchObject({
      email: 'lifecycle@example.com',
      role: 'USER',
      status: 'ACTIVE',
    });
    expect(firstProfile.body).not.toHaveProperty('passwordHash');

    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: registered.refreshToken })
      .expect(200);
    expect(rotated.body.refreshToken).not.toBe(registered.refreshToken);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: registered.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Authorization', bearer(rotated.body.accessToken))
      .send({ currentPassword: strongPassword, newPassword })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'lifecycle@example.com', password: strongPassword })
      .expect(401);
    const signedIn = await login('lifecycle@example.com', newPassword);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', bearer(signedIn.accessToken))
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(signedIn.accessToken))
      .expect(401);

    const audit = await request(app.getHttpServer())
      .get('/api/admin/audit-logs?action=PASSWORD_CHANGED')
      .set('Authorization', bearer(adminToken))
      .expect(200);
    expect(audit.body.items).toHaveLength(1);
    expect(audit.body.items[0].metadata).toBeNull();
    expect(audit.body.items[0]).not.toHaveProperty('password');
    expect(audit.body.items[0]).not.toHaveProperty('refreshToken');
    expect(audit.body.items[0]).not.toHaveProperty('accessToken');
  });

  it('covers admin status enforcement, attendance ownership, finance aggregates, and audit mutation history', async () => {
    const member = await register('member@example.com');
    const outsider = await register('outsider@example.com');
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const monthQuery = `year=${year}&month=${month}`;

    const list = await request(app.getHttpServer())
      .get(
        '/api/admin/users?search=member&page=1&pageSize=10&sortBy=email&sortDirection=asc',
      )
      .set('Authorization', bearer(adminToken))
      .expect(200);
    expect(
      list.body.items.map((item: { email: string }) => item.email),
    ).toContain('member@example.com');
    const memberId = member.user.id as string;
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${memberId}/attendance`)
      .set('Authorization', bearer(adminToken))
      .send({ enabled: true })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/admin/users/${memberId}`)
      .set('Authorization', bearer(outsider.accessToken))
      .expect(403);
    const today = await request(app.getHttpServer())
      .get('/api/attendance/today?timezone=Asia%2FBangkok')
      .set('Authorization', bearer(member.accessToken))
      .expect(200);
    expect(today.body.checkedIn).toBe(false);
    await request(app.getHttpServer())
      .post('/api/attendance/check-in')
      .set('Authorization', bearer(member.accessToken))
      .send({ timezone: 'Asia/Bangkok', note: 'E2E check-in' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/attendance/check-in')
      .set('Authorization', bearer(member.accessToken))
      .send({ timezone: 'Asia/Bangkok' })
      .expect(409);
    const attendance = await request(app.getHttpServer())
      .get(`/api/attendance?${monthQuery}`)
      .set('Authorization', bearer(member.accessToken))
      .expect(200);
    expect(attendance.body.items).toHaveLength(1);
    await request(app.getHttpServer())
      .get(`/api/admin/users/${memberId}/attendance?${monthQuery}`)
      .set('Authorization', bearer(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/admin/users/${memberId}/attendance?${monthQuery}`)
      .set('Authorization', bearer(outsider.accessToken))
      .expect(403);

    const expenseCategory = await createCategory(
      member.accessToken,
      'E2E Expense',
      FinanceTransactionType.EXPENSE,
    );
    const incomeCategory = await createCategory(
      member.accessToken,
      'E2E Income',
      FinanceTransactionType.INCOME,
    );
    const expense = await createTransaction(
      member.accessToken,
      expenseCategory.id,
      FinanceTransactionType.EXPENSE,
      '350000',
    );
    await createTransaction(
      member.accessToken,
      incomeCategory.id,
      FinanceTransactionType.INCOME,
      '1000000',
    );
    const summary = await request(app.getHttpServer())
      .get(`/api/finance/summary?${monthQuery}`)
      .set('Authorization', bearer(member.accessToken))
      .expect(200);
    expect(summary.body).toMatchObject({
      totalIncome: '1000000',
      totalExpense: '350000',
      netBalance: '650000',
    });

    await request(app.getHttpServer())
      .post('/api/finance/budgets')
      .set('Authorization', bearer(member.accessToken))
      .send({ year, month, amount: '300000', currency: 'VND' })
      .expect(201);
    const analytics = await request(app.getHttpServer())
      .get(`/api/finance/analytics?${monthQuery}`)
      .set('Authorization', bearer(member.accessToken))
      .expect(200);
    expect(analytics.body.totalExpense).toBe('350000');
    await request(app.getHttpServer())
      .get(`/api/finance/transactions/${expense.id}`)
      .set('Authorization', bearer(outsider.accessToken))
      .expect(404);
    const adminFinance = await request(app.getHttpServer())
      .get(`/api/admin/users/${memberId}/transactions?${monthQuery}`)
      .set('Authorization', bearer(adminToken))
      .expect(200);
    expect(adminFinance.body.items).toHaveLength(2);

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${memberId}/status`)
      .set('Authorization', bearer(adminToken))
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(member.accessToken))
      .expect(401);
    const statusAudit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'ADMIN_USER_STATUS_CHANGED', targetId: memberId },
    });
    expect(statusAudit.metadata).toEqual({
      previousStatus: 'ACTIVE',
      newStatus: 'SUSPENDED',
    });
  });

  it('enforces refresh and attendance concurrency without timing assumptions', async () => {
    const member = await register('concurrency@example.com');
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${member.user.id}/attendance`)
      .set('Authorization', bearer(adminToken))
      .send({ enabled: true })
      .expect(200);
    const refreshResults = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: member.refreshToken }),
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: member.refreshToken }),
    ]);
    expect(refreshResults.map((result) => result.status).sort()).toEqual([
      200, 401,
    ]);

    const checkIns = await Promise.all([
      request(app.getHttpServer())
        .post('/api/attendance/check-in')
        .set('Authorization', bearer(member.accessToken))
        .send({ timezone: 'Asia/Bangkok' }),
      request(app.getHttpServer())
        .post('/api/attendance/check-in')
        .set('Authorization', bearer(member.accessToken))
        .send({ timezone: 'Asia/Bangkok' }),
    ]);
    expect(checkIns.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.attendance.count({ where: { userId: member.user.id } }),
    ).toBe(1);
  });

  it('persists one Gold Alert trigger and one notification across repeated evaluation', async () => {
    const member = await register('gold@example.com');
    await prisma.goldPriceSnapshot.create({
      data: {
        provider: 'e2e',
        productCode: 'SJC',
        productName: 'SJC Gold',
        buyPrice: 90_000_000n,
        sellPrice: 91_000_000n,
        currency: Currency.VND,
        unit: 'LUONG',
        sourceTimestamp: new Date(),
        fingerprint: 'e2e-gold-snapshot',
      },
    });
    await prisma.goldAlert.create({
      data: {
        userId: member.user.id,
        productCode: 'SJC',
        priceSide: GoldAlertPriceSide.BUY,
        condition: GoldAlertCondition.ABOVE,
        thresholdAmount: 80_000_000n,
        cooldownMinutes: 60,
      },
    });
    const alerts = app.get(GoldAlertsService);
    await expect(alerts.evaluate()).resolves.toMatchObject({ triggered: 1 });
    await expect(alerts.evaluate()).resolves.toMatchObject({ triggered: 0 });
    expect(
      await prisma.goldAlertTrigger.count({
        where: { userId: member.user.id },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({ where: { userId: member.user.id } }),
    ).toBe(1);
  });

  async function register(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        displayName: email.split('@')[0],
        password: strongPassword,
      })
      .expect(201);
    return response.body;
  }

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body;
  }

  async function createCategory(
    token: string,
    name: string,
    type: FinanceTransactionType,
  ) {
    const response = await request(app.getHttpServer())
      .post('/api/finance/categories')
      .set('Authorization', bearer(token))
      .send({ name, type })
      .expect(201);
    return response.body;
  }

  async function createTransaction(
    token: string,
    categoryId: string,
    type: FinanceTransactionType,
    amount: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/api/finance/transactions')
      .set('Authorization', bearer(token))
      .send({
        type,
        amount,
        currency: 'VND',
        categoryId,
        occurredAt: new Date().toISOString(),
      })
      .expect(201);
    return response.body;
  }

  async function cleanDatabase() {
    await prisma.notificationDelivery.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.goldAlertTrigger.deleteMany();
    await prisma.goldAlert.deleteMany();
    await prisma.goldPriceSnapshot.deleteMany();
    await prisma.pushDevice.deleteMany();
    await prisma.financeTransaction.deleteMany();
    await prisma.financeBudget.deleteMany();
    await prisma.transactionCategory.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.user.deleteMany();
  }
});

function bearer(token: string): string {
  return `Bearer ${token}`;
}
