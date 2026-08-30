CREATE TABLE "GoldPriceSnapshot" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "buyPrice" BIGINT NOT NULL,
  "sellPrice" BIGINT NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'VND',
  "unit" TEXT NOT NULL,
  "sourceTimestamp" TIMESTAMP(3) NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoldPriceSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoldPriceSnapshot_buyPrice_check" CHECK ("buyPrice" > 0),
  CONSTRAINT "GoldPriceSnapshot_sellPrice_check" CHECK ("sellPrice" > 0)
);

CREATE UNIQUE INDEX "GoldPriceSnapshot_fingerprint_key" ON "GoldPriceSnapshot"("fingerprint");
CREATE INDEX "GoldPriceSnapshot_productCode_sourceTimestamp_idx" ON "GoldPriceSnapshot"("productCode", "sourceTimestamp" DESC);
CREATE INDEX "GoldPriceSnapshot_provider_fetchedAt_idx" ON "GoldPriceSnapshot"("provider", "fetchedAt" DESC);
