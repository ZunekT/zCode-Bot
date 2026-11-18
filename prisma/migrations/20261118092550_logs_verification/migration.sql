-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('PASSED', 'MANUAL', 'FAILED', 'BLOCKED_AGE', 'BLOCKED_LOCKDOWN');

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "antiRaidEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "antiRaidJoins" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "antiRaidSeconds" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "logChannels" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "logIgnoredChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "unverifiedRoleId" TEXT,
ADD COLUMN     "verificationLockdown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationMinAccountAgeDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verificationMode" TEXT NOT NULL DEFAULT 'captcha';

-- CreateTable
CREATE TABLE "VerificationEvent" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "result" "VerificationResult" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationEvent_createdAt_idx" ON "VerificationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "VerificationEvent_userId_idx" ON "VerificationEvent"("userId");
