-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EnrollmentStatus" ADD VALUE 'GRADUATED';
ALTER TYPE "EnrollmentStatus" ADD VALUE 'NOT_GRADUATED';
ALTER TYPE "EnrollmentStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "leadershipBadge" "LeadershipLevel";

-- CreateTable
CREATE TABLE "LeadershipAttendance" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadershipAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadershipAssignment" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadershipAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadershipGrade" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "assignmentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "gradedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedById" TEXT,

    CONSTRAINT "LeadershipGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadershipAttendance_sessionId_idx" ON "LeadershipAttendance"("sessionId");

-- CreateIndex
CREATE INDEX "LeadershipAttendance_memberId_idx" ON "LeadershipAttendance"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadershipAttendance_sessionId_memberId_key" ON "LeadershipAttendance"("sessionId", "memberId");

-- CreateIndex
CREATE INDEX "LeadershipAssignment_classId_idx" ON "LeadershipAssignment"("classId");

-- CreateIndex
CREATE INDEX "LeadershipGrade_memberId_idx" ON "LeadershipGrade"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadershipGrade_assignmentId_memberId_key" ON "LeadershipGrade"("assignmentId", "memberId");

-- AddForeignKey
ALTER TABLE "LeadershipAttendance" ADD CONSTRAINT "LeadershipAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LeadershipSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadershipAttendance" ADD CONSTRAINT "LeadershipAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadershipAssignment" ADD CONSTRAINT "LeadershipAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "LeadershipClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadershipGrade" ADD CONSTRAINT "LeadershipGrade_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "LeadershipAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadershipGrade" ADD CONSTRAINT "LeadershipGrade_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
