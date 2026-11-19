-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('BOT', 'WEBSITE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'WON', 'CLOSED');

-- AlterEnum
ALTER TYPE "TicketCategory" ADD VALUE 'WEBSITE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "kind" "ServiceKind" NOT NULL DEFAULT 'BOT';

-- AlterTable
ALTER TABLE "PricingPackage" ADD COLUMN     "kind" "ServiceKind" NOT NULL DEFAULT 'BOT';

-- AlterTable
ALTER TABLE "PricingItem" ADD COLUMN     "kind" "ServiceKind" NOT NULL DEFAULT 'BOT';

-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "kind" "ServiceKind" NOT NULL DEFAULT 'BOT';

-- AlterTable
ALTER TABLE "MonitoredBot" ADD COLUMN     "sslExpiresAt" TIMESTAMP(3),
ADD COLUMN     "sslWarnedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "kind" "ServiceKind" NOT NULL DEFAULT 'WEBSITE',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "siteType" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT,
    "discord" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "ipHash" TEXT NOT NULL,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

