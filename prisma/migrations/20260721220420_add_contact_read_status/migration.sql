-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_isResolved_idx" ON "ContactMessage"("isResolved");

-- CreateIndex
CREATE INDEX "ContactMessage_isRead_idx" ON "ContactMessage"("isRead");

-- CreateIndex
CREATE INDEX "ContactMessage_assignedToId_idx" ON "ContactMessage"("assignedToId");

-- CreateIndex
CREATE INDEX "ContactMessage_deletedAt_idx" ON "ContactMessage"("deletedAt");
