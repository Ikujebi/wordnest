/*
  Warnings:

  - You are about to drop the `WebAnalyticsSnapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "WebAnalyticsSnapshot";

-- CreateTable
CREATE TABLE "WebAnalyticsVisitor" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAnalyticsVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAnalyticsSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "referrer" TEXT,

    CONSTRAINT "WebAnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "path" TEXT,
    "title" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitorId" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "WebAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebAnalyticsVisitor_visitorId_key" ON "WebAnalyticsVisitor"("visitorId");

-- CreateIndex
CREATE INDEX "WebAnalyticsVisitor_lastSeenAt_idx" ON "WebAnalyticsVisitor"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebAnalyticsSession_sessionId_key" ON "WebAnalyticsSession"("sessionId");

-- CreateIndex
CREATE INDEX "WebAnalyticsSession_visitorId_idx" ON "WebAnalyticsSession"("visitorId");

-- CreateIndex
CREATE INDEX "WebAnalyticsSession_startedAt_idx" ON "WebAnalyticsSession"("startedAt");

-- CreateIndex
CREATE INDEX "WebAnalyticsSession_lastSeenAt_idx" ON "WebAnalyticsSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "WebAnalyticsEvent_createdAt_idx" ON "WebAnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "WebAnalyticsEvent_event_idx" ON "WebAnalyticsEvent"("event");

-- CreateIndex
CREATE INDEX "WebAnalyticsEvent_visitorId_idx" ON "WebAnalyticsEvent"("visitorId");

-- CreateIndex
CREATE INDEX "WebAnalyticsEvent_sessionId_idx" ON "WebAnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "WebAnalyticsEvent_path_idx" ON "WebAnalyticsEvent"("path");

-- AddForeignKey
ALTER TABLE "WebAnalyticsSession" ADD CONSTRAINT "WebAnalyticsSession_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "WebAnalyticsVisitor"("visitorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAnalyticsEvent" ADD CONSTRAINT "WebAnalyticsEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "WebAnalyticsVisitor"("visitorId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAnalyticsEvent" ADD CONSTRAINT "WebAnalyticsEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WebAnalyticsSession"("sessionId") ON DELETE SET NULL ON UPDATE CASCADE;
