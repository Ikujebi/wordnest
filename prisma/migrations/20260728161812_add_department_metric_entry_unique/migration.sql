/*
  Warnings:

  - A unique constraint covering the columns `[departmentId,metricId,period]` on the table `DepartmentMetricEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "DepartmentMetricEntry_departmentId_idx" ON "DepartmentMetricEntry"("departmentId");

-- CreateIndex
CREATE INDEX "DepartmentMetricEntry_metricId_idx" ON "DepartmentMetricEntry"("metricId");

-- CreateIndex
CREATE INDEX "DepartmentMetricEntry_period_idx" ON "DepartmentMetricEntry"("period");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMetricEntry_departmentId_metricId_period_key" ON "DepartmentMetricEntry"("departmentId", "metricId", "period");
