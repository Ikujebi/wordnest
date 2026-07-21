-- CreateEnum
CREATE TYPE "PrayerRequestCategory" AS ENUM ('HEALING', 'FINANCIAL_PROVISION', 'FAMILY_MARRIAGE', 'SALVATION', 'DELIVERANCE', 'JOB', 'SCHOOL', 'THANKSGIVING', 'OTHER');

-- CreateEnum
CREATE TYPE "PrayerRequestVisibility" AS ENUM ('PRIVATE', 'TEAM_ONLY', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PrayerRequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PrayerRequestStatus" AS ENUM ('PENDING', 'ASSIGNED', 'PRAYING', 'ANSWERED', 'CLOSED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommunicationType" ADD VALUE 'PRAYER_REQUEST_RECEIVED';
ALTER TYPE "CommunicationType" ADD VALUE 'PRAYER_REQUEST_ASSIGNED';
ALTER TYPE "CommunicationType" ADD VALUE 'PRAYER_REQUEST_ANSWERED';
ALTER TYPE "CommunicationType" ADD VALUE 'PRAYER_TEAM_NOTE';
ALTER TYPE "CommunicationType" ADD VALUE 'PRAYER_FOLLOW_UP';

-- AlterTable
ALTER TABLE "Communication" ADD COLUMN     "prayerRequestId" TEXT;

-- CreateTable
CREATE TABLE "PrayerRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT,
    "memberId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" "PrayerRequestCategory" NOT NULL DEFAULT 'OTHER',
    "visibility" "PrayerRequestVisibility" NOT NULL DEFAULT 'PRIVATE',
    "priority" "PrayerRequestPriority" NOT NULL DEFAULT 'NORMAL',
    "isConfidential" BOOLEAN NOT NULL DEFAULT true,
    "status" "PrayerRequestStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrayerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerRequestNote" (
    "id" TEXT NOT NULL,
    "prayerRequestId" TEXT NOT NULL,
    "authorId" TEXT,
    "note" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrayerRequestNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrayerRequest_status_idx" ON "PrayerRequest"("status");

-- CreateIndex
CREATE INDEX "PrayerRequest_category_idx" ON "PrayerRequest"("category");

-- CreateIndex
CREATE INDEX "PrayerRequest_priority_idx" ON "PrayerRequest"("priority");

-- CreateIndex
CREATE INDEX "PrayerRequest_memberId_idx" ON "PrayerRequest"("memberId");

-- CreateIndex
CREATE INDEX "PrayerRequest_requesterId_idx" ON "PrayerRequest"("requesterId");

-- CreateIndex
CREATE INDEX "PrayerRequestNote_prayerRequestId_idx" ON "PrayerRequestNote"("prayerRequestId");

-- CreateIndex
CREATE INDEX "PrayerRequestNote_authorId_idx" ON "PrayerRequestNote"("authorId");

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_prayerRequestId_fkey" FOREIGN KEY ("prayerRequestId") REFERENCES "PrayerRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerRequest" ADD CONSTRAINT "PrayerRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerRequest" ADD CONSTRAINT "PrayerRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerRequest" ADD CONSTRAINT "PrayerRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerRequest" ADD CONSTRAINT "PrayerRequest_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerRequestNote" ADD CONSTRAINT "PrayerRequestNote_prayerRequestId_fkey" FOREIGN KEY ("prayerRequestId") REFERENCES "PrayerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerRequestNote" ADD CONSTRAINT "PrayerRequestNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
