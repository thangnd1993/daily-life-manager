CREATE TABLE "SystemRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SystemRecord_key_key" ON "SystemRecord"("key");
