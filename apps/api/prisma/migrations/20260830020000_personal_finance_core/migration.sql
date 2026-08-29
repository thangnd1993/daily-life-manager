CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "Currency" AS ENUM ('VND');

CREATE TABLE "TransactionCategory" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "type" "FinanceTransactionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "FinanceTransactionType" NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'VND',
  "categoryId" TEXT NOT NULL,
  "description" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionCategory_userId_name_type_key" ON "TransactionCategory"("userId", "name", "type");
CREATE INDEX "TransactionCategory_userId_type_idx" ON "TransactionCategory"("userId", "type");
CREATE INDEX "FinanceTransaction_userId_occurredAt_idx" ON "FinanceTransaction"("userId", "occurredAt" DESC);
CREATE INDEX "FinanceTransaction_categoryId_idx" ON "FinanceTransaction"("categoryId");
ALTER TABLE "TransactionCategory" ADD CONSTRAINT "TransactionCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TransactionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "TransactionCategory" ("id", "name", "type", "updatedAt") VALUES
('system-expense-food', 'Food', 'EXPENSE', CURRENT_TIMESTAMP),
('system-expense-transport', 'Transport', 'EXPENSE', CURRENT_TIMESTAMP),
('system-expense-shopping', 'Shopping', 'EXPENSE', CURRENT_TIMESTAMP),
('system-expense-bills', 'Bills', 'EXPENSE', CURRENT_TIMESTAMP),
('system-expense-health', 'Health', 'EXPENSE', CURRENT_TIMESTAMP),
('system-expense-entertainment', 'Entertainment', 'EXPENSE', CURRENT_TIMESTAMP),
('system-expense-other', 'Other', 'EXPENSE', CURRENT_TIMESTAMP),
('system-income-salary', 'Salary', 'INCOME', CURRENT_TIMESTAMP),
('system-income-bonus', 'Bonus', 'INCOME', CURRENT_TIMESTAMP),
('system-income-business', 'Business', 'INCOME', CURRENT_TIMESTAMP),
('system-income-gift', 'Gift', 'INCOME', CURRENT_TIMESTAMP),
('system-income-other', 'Other', 'INCOME', CURRENT_TIMESTAMP);
