-- CreateTable
CREATE TABLE "DepartmentMetric" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMetricEntry" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "achievedValue" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentMetricEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DepartmentMetric" ADD CONSTRAINT "DepartmentMetric_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMetricEntry" ADD CONSTRAINT "DepartmentMetricEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMetricEntry" ADD CONSTRAINT "DepartmentMetricEntry_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "DepartmentMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
