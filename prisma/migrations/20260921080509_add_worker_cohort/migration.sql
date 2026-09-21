-- AlterTable
ALTER TABLE "WorkerInTraining" ADD COLUMN     "cohortId" TEXT;

-- CreateTable
CREATE TABLE "WorkerCohort" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerCohort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerCohort_isOpen_idx" ON "WorkerCohort"("isOpen");

-- AddForeignKey
ALTER TABLE "WorkerInTraining" ADD CONSTRAINT "WorkerInTraining_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "WorkerCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
