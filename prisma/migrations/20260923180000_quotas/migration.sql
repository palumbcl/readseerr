-- AlterTable
ALTER TABLE "User" ADD COLUMN "quotaLimit" INTEGER;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

