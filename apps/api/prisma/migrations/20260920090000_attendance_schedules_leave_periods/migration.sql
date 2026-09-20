ALTER TABLE "User"
ADD COLUMN "workingWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[];

CREATE TABLE "AttendanceLeavePeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceLeavePeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceLeavePeriod_userId_startDate_endDate_idx"
ON "AttendanceLeavePeriod"("userId", "startDate", "endDate");

ALTER TABLE "AttendanceLeavePeriod"
ADD CONSTRAINT "AttendanceLeavePeriod_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
