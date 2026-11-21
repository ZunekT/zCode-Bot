-- CreateEnum
CREATE TYPE "ModAction" AS ENUM ('WARN', 'NOTE', 'TIMEOUT', 'UNTIMEOUT', 'KICK', 'SOFTBAN', 'BAN', 'UNBAN');

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "giveawayManagerRoleId" TEXT,
ADD COLUMN     "giveawayPingRoleId" TEXT,
ADD COLUMN     "modAppealText" TEXT,
ADD COLUMN     "modDmUsers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "modLogChannelId" TEXT,
ADD COLUMN     "modRequireReason" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pollsForEveryone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warnBanAt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warnExpireDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "warnKickAt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warnTimeoutAt" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "warnTimeoutMinutes" INTEGER NOT NULL DEFAULT 60;

-- DropTable
DROP TABLE "Giveaway";

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" SERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "hostId" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "description" TEXT,
    "winners" INTEGER NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "requiredRoleId" TEXT,
    "minAccountDays" INTEGER NOT NULL DEFAULT 0,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "winnerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModCase" (
    "id" SERIAL NOT NULL,
    "action" "ModAction" NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT,
    "durationMs" BIGINT,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "giveawayId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("giveawayId","userId")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" SERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "authorId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "multi" BOOLEAN NOT NULL DEFAULT false,
    "hideResults" BOOLEAN NOT NULL DEFAULT false,
    "endsAt" TIMESTAMP(3),
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "pollId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "option" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("pollId","userId","option")
);

-- CreateIndex
CREATE INDEX "ModCase_userId_createdAt_idx" ON "ModCase"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModCase_action_active_expiresAt_idx" ON "ModCase"("action", "active", "expiresAt");

-- CreateIndex
CREATE INDEX "Poll_ended_endsAt_idx" ON "Poll"("ended", "endsAt");

-- CreateIndex
CREATE INDEX "Giveaway_ended_endsAt_idx" ON "Giveaway"("ended", "endsAt");

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

