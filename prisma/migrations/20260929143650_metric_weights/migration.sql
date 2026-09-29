-- CreateEnum
CREATE TYPE "MetricWeightingMode" AS ENUM ('EQUAL', 'CUSTOM');

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "weightingMode" "MetricWeightingMode" NOT NULL DEFAULT 'EQUAL';

-- AlterTable
ALTER TABLE "DepartmentMetric" ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 0;
