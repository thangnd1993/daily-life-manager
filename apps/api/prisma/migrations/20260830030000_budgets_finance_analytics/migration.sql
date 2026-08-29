CREATE TABLE "FinanceBudget" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "categoryId" TEXT,
  "amount" BIGINT NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'VND',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceBudget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceBudget_year_check" CHECK ("year" BETWEEN 2000 AND 2100),
  CONSTRAINT "FinanceBudget_month_check" CHECK ("month" BETWEEN 1 AND 12),
  CONSTRAINT "FinanceBudget_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "FinanceBudget_overall_month_key"
  ON "FinanceBudget"("userId", "year", "month") WHERE "categoryId" IS NULL;
CREATE UNIQUE INDEX "FinanceBudget_category_month_key"
  ON "FinanceBudget"("userId", "year", "month", "categoryId") WHERE "categoryId" IS NOT NULL;
CREATE INDEX "FinanceBudget_userId_year_month_idx" ON "FinanceBudget"("userId", "year", "month");
CREATE INDEX "FinanceBudget_categoryId_idx" ON "FinanceBudget"("categoryId");
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TransactionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
