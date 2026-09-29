/*
  Warnings:

  - You are about to drop the column `targetValue` on the `DepartmentMetric` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `DepartmentMetric` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `DepartmentMetric` table. All the data in the column will be lost.
  - You are about to drop the column `achievedValue` on the `DepartmentMetricEntry` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[departmentId,questionId]` on the table `DepartmentMetric` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `questionId` to the `DepartmentMetric` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rating` to the `DepartmentMetricEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DepartmentMetric" DROP COLUMN "targetValue",
DROP COLUMN "title",
DROP COLUMN "weight",
ADD COLUMN     "questionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DepartmentMetricEntry" DROP COLUMN "achievedValue",
ADD COLUMN     "rating" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "PerformanceQuestion" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "text" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PerformanceQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceQuestion_text_key" ON "PerformanceQuestion"("text");

-- CreateIndex
CREATE INDEX "PerformanceQuestion_text_idx" ON "PerformanceQuestion"("text");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMetric_departmentId_questionId_key" ON "DepartmentMetric"("departmentId", "questionId");

-- AddForeignKey
ALTER TABLE "DepartmentMetric" ADD CONSTRAINT "DepartmentMetric_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PerformanceQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
