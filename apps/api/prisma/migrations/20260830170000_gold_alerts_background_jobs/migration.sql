CREATE TYPE "GoldAlertPriceSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "GoldAlertCondition" AS ENUM ('ABOVE', 'BELOW', 'PERCENT_CHANGE');

CREATE TABLE "GoldAlert" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "priceSide" "GoldAlertPriceSide" NOT NULL,
  "condition" "GoldAlertCondition" NOT NULL,
  "thresholdAmount" BIGINT,
  "thresholdBasisPoints" INTEGER,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
  "lastTriggeredAt" TIMESTAMP(3),
  "wasMatching" BOOLEAN NOT NULL DEFAULT false,
  "lastEvaluatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoldAlert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoldAlert_threshold_check" CHECK (
    ("condition" IN ('ABOVE', 'BELOW') AND "thresholdAmount" > 0 AND "thresholdBasisPoints" IS NULL) OR
    ("condition" = 'PERCENT_CHANGE' AND "thresholdAmount" IS NULL AND "thresholdBasisPoints" > 0)
  ),
  CONSTRAINT "GoldAlert_cooldown_check" CHECK ("cooldownMinutes" BETWEEN 5 AND 10080)
);

CREATE TABLE "GoldAlertTrigger" (
  "id" TEXT NOT NULL,
  "alertId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "observedBuyPrice" BIGINT NOT NULL,
  "observedSellPrice" BIGINT NOT NULL,
  "matchedValue" TEXT NOT NULL,
  "condition" "GoldAlertCondition" NOT NULL,
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoldAlertTrigger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoldAlertTrigger_prices_check" CHECK ("observedBuyPrice" > 0 AND "observedSellPrice" > 0)
);

CREATE INDEX "GoldAlert_userId_idx" ON "GoldAlert"("userId");
CREATE INDEX "GoldAlert_productCode_isEnabled_idx" ON "GoldAlert"("productCode", "isEnabled");
CREATE INDEX "GoldAlertTrigger_userId_triggeredAt_idx" ON "GoldAlertTrigger"("userId", "triggeredAt" DESC);
CREATE INDEX "GoldAlertTrigger_alertId_triggeredAt_idx" ON "GoldAlertTrigger"("alertId", "triggeredAt" DESC);
ALTER TABLE "GoldAlert" ADD CONSTRAINT "GoldAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoldAlertTrigger" ADD CONSTRAINT "GoldAlertTrigger_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "GoldAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoldAlertTrigger" ADD CONSTRAINT "GoldAlertTrigger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
