-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "resolvedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "Ministry" ADD COLUMN     "leaderWorkerId" TEXT;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_leaderWorkerId_fkey" FOREIGN KEY ("leaderWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
