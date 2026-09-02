CREATE TYPE "AttendanceStatus" AS ENUM ('WORKED', 'OFF');

ALTER TYPE "AttendanceSource" ADD VALUE 'AUTO';
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_AUTO_RECORDED';

ALTER TABLE "User"
  ADD COLUMN "attendanceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "leaveModeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "leaveModeStartedAt" TIMESTAMP(3),
  ADD COLUMN "leaveReason" TEXT,
  ADD COLUMN "attendanceTimezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN "defaultDailyWorkMinutes" INTEGER NOT NULL DEFAULT 240;

ALTER TABLE "Attendance"
  ADD COLUMN "workedMinutes" INTEGER NOT NULL DEFAULT 240,
  ADD COLUMN "status" "AttendanceStatus" NOT NULL DEFAULT 'WORKED',
  ADD COLUMN "offReason" TEXT,
  ADD COLUMN "autoRecordedAt" TIMESTAMP(3);

ALTER TABLE "Notification"
  ALTER COLUMN "goldAlertTriggerId" DROP NOT NULL,
  ADD COLUMN "attendanceId" TEXT;

CREATE UNIQUE INDEX "Notification_attendanceId_key" ON "Notification"("attendanceId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attendanceId_fkey"
  FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
