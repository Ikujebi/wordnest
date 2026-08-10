/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Ministry` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Ministry` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'RSVPED';
ALTER TYPE "AttendanceStatus" ADD VALUE 'REGISTERED';

-- DropForeignKey
ALTER TABLE "Ministry" DROP CONSTRAINT "Ministry_leaderId_fkey";

-- DropIndex
DROP INDEX "Ministry_leaderId_key";

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "receiveEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "receiveSmsNotifications" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ministry" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "memberId" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "status" "RsvpStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryMember" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "memberId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL DEFAULT 'Member',
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "status" "DepartmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "MinistryMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventRsvp_eventId_idx" ON "EventRsvp"("eventId");

-- CreateIndex
CREATE INDEX "EventRsvp_userId_idx" ON "EventRsvp"("userId");

-- CreateIndex
CREATE INDEX "EventRsvp_memberId_idx" ON "EventRsvp"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRsvp_eventId_memberId_key" ON "EventRsvp"("eventId", "memberId");

-- CreateIndex
CREATE INDEX "MinistryMember_ministryId_idx" ON "MinistryMember"("ministryId");

-- CreateIndex
CREATE INDEX "MinistryMember_memberId_idx" ON "MinistryMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MinistryMember_memberId_ministryId_key" ON "MinistryMember"("memberId", "ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "Ministry_slug_key" ON "Ministry"("slug");

-- CreateIndex
CREATE INDEX "Ministry_leaderId_idx" ON "Ministry"("leaderId");

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
