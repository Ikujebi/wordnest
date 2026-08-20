-- AlterTable
ALTER TABLE "Communication" ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
