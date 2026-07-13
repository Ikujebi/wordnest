-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'IN_APP');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('ANNOUNCEMENT', 'NEWSLETTER', 'DEVOTIONAL', 'EVENT', 'SERMON', 'PRAYER_UPDATE', 'THANK_YOU', 'FOLLOW_UP', 'EMERGENCY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "status" "CommunicationStatus" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMPTZ(6),
    "archivedAt" TIMESTAMPTZ(6),
    "metadata" JSONB DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "channels" "CommunicationChannel"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationRecipient" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "memberId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "RecipientStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
