-- CreateTable
CREATE TABLE "WebAnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalVisitors" INTEGER NOT NULL DEFAULT 0,
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "totalPageviews" INTEGER NOT NULL DEFAULT 0,
    "newVisitors" INTEGER NOT NULL DEFAULT 0,
    "returningVisits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebAnalyticsSnapshot_date_key" ON "WebAnalyticsSnapshot"("date");

-- CreateIndex
CREATE INDEX "WebAnalyticsSnapshot_date_idx" ON "WebAnalyticsSnapshot"("date");
