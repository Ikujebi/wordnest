-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_memberId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationLog" DROP CONSTRAINT "CommunicationLog_communicationId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationRecipient" DROP CONSTRAINT "CommunicationRecipient_communicationId_fkey";

-- DropForeignKey
ALTER TABLE "DepartmentMember" DROP CONSTRAINT "DepartmentMember_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "DepartmentMember" DROP CONSTRAINT "DepartmentMember_memberId_fkey";

-- DropForeignKey
ALTER TABLE "LeadershipEnrollment" DROP CONSTRAINT "LeadershipEnrollment_classId_fkey";

-- DropForeignKey
ALTER TABLE "LeadershipEnrollment" DROP CONSTRAINT "LeadershipEnrollment_memberId_fkey";

-- DropForeignKey
ALTER TABLE "LeadershipSession" DROP CONSTRAINT "LeadershipSession_classId_fkey";

-- DropForeignKey
ALTER TABLE "MinistryMember" DROP CONSTRAINT "MinistryMember_memberId_fkey";

-- DropForeignKey
ALTER TABLE "MinistryMember" DROP CONSTRAINT "MinistryMember_ministryId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Worker" DROP CONSTRAINT "Worker_memberId_fkey";

-- DropForeignKey
ALTER TABLE "WorkerAttendance" DROP CONSTRAINT "WorkerAttendance_workerId_fkey";

-- DropForeignKey
ALTER TABLE "WorkerInTraining" DROP CONSTRAINT "WorkerInTraining_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "WorkerInTraining" DROP CONSTRAINT "WorkerInTraining_memberId_fkey";

-- AlterTable
ALTER TABLE "Communication" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "scheduledAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "CommunicationLog" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "CommunicationRecipient" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "DepartmentMetric" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "DepartmentMetricEntry" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "EmailVerificationToken" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "Invitation" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "acceptedAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "PasswordResetToken" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "PrayerRequest" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "answeredAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "acknowledgedAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "closedAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "PrayerRequestNote" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;

-- AlterTable
ALTER TABLE "Subscriber" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "unsubscribeToken" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "unsubscribedAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "SystemSetting" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6);

-- DropEnum
DROP TYPE "CounsellingStatus";

-- DropEnum
DROP TYPE "FollowUpStatus";

-- DropEnum
DROP TYPE "PrayerStatus";

-- DropEnum
DROP TYPE "StreamPlatform";

-- DropEnum
DROP TYPE "VolunteerStatus";

-- CreateIndex
CREATE INDEX "Attendance_memberId_idx" ON "Attendance"("memberId");

-- CreateIndex
CREATE INDEX "BlogPost_authorId_idx" ON "BlogPost"("authorId");

-- CreateIndex
CREATE INDEX "Communication_createdById_idx" ON "Communication"("createdById");

-- CreateIndex
CREATE INDEX "Communication_status_idx" ON "Communication"("status");

-- CreateIndex
CREATE INDEX "CommunicationLog_communicationId_idx" ON "CommunicationLog"("communicationId");

-- CreateIndex
CREATE INDEX "DepartmentMetric_departmentId_idx" ON "DepartmentMetric"("departmentId");

-- CreateIndex
CREATE INDEX "Giving_memberId_idx" ON "Giving"("memberId");

-- CreateIndex
CREATE INDEX "Giving_createdAt_idx" ON "Giving"("createdAt");

-- CreateIndex
CREATE INDEX "LeadershipClass_facilitatorId_idx" ON "LeadershipClass"("facilitatorId");

-- CreateIndex
CREATE INDEX "LeadershipEnrollment_memberId_idx" ON "LeadershipEnrollment"("memberId");

-- CreateIndex
CREATE INDEX "LeadershipEnrollment_classId_idx" ON "LeadershipEnrollment"("classId");

-- CreateIndex
CREATE INDEX "LeadershipSession_classId_idx" ON "LeadershipSession"("classId");

-- CreateIndex
CREATE INDEX "MediaGallery_eventId_idx" ON "MediaGallery"("eventId");

-- CreateIndex
CREATE INDEX "Member_email_idx" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_phoneNumber_idx" ON "Member"("phoneNumber");

-- CreateIndex
CREATE INDEX "Worker_memberId_idx" ON "Worker"("memberId");

-- CreateIndex
CREATE INDEX "Worker_ministryId_idx" ON "Worker"("ministryId");

-- CreateIndex
CREATE INDEX "WorkerInTraining_memberId_idx" ON "WorkerInTraining"("memberId");

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAttendance" ADD CONSTRAINT "WorkerAttendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadershipSession" ADD CONSTRAINT "LeadershipSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "LeadershipClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadershipEnrollment" ADD CONSTRAINT "LeadershipEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "LeadershipClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadershipEnrollment" ADD CONSTRAINT "LeadershipEnrollment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInTraining" ADD CONSTRAINT "WorkerInTraining_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInTraining" ADD CONSTRAINT "WorkerInTraining_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
