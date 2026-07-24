/*
  Warnings:

  - You are about to drop the column `title` on the `LeadershipClass` table. All the data in the column will be lost.
  - Added the required column `name` to the `LeadershipClass` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LeadershipClass" DROP COLUMN "title",
ADD COLUMN     "name" TEXT NOT NULL;
