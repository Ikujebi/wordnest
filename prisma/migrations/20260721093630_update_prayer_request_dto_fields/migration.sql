-- AlterTable
ALTER TABLE "PrayerRequest" ADD COLUMN     "allowFollowUp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "followUpSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "internalSummary" TEXT,
ADD COLUMN     "preferredContactMethod" TEXT,
ADD COLUMN     "testimony" TEXT;
