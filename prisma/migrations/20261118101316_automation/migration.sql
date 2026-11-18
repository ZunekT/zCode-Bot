-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageName" TEXT,
ADD COLUMN     "imageType" TEXT;

-- AlterTable
ALTER TABLE "ChangelogEntry" ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "releaseUrl" TEXT;

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "statusBoardChannelId" TEXT,
ADD COLUMN     "statusBoardMessageId" TEXT;

-- AlterTable
ALTER TABLE "MonitoredBot" ADD COLUMN     "checksOk" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "checksTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "heartbeatToken" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "lastResponseMs" INTEGER,
ADD COLUMN     "lastUpAt" TIMESTAMP(3),
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'http',
ADD COLUMN     "orderId" INTEGER;

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "channelId" TEXT;

-- CreateTable
CREATE TABLE "DailyStat" (
    "date" TEXT NOT NULL,
    "members" INTEGER NOT NULL DEFAULT 0,
    "joins" INTEGER NOT NULL DEFAULT 0,
    "leaves" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "ChangelogProject" (
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repo" TEXT,
    "roleId" TEXT,
    "channelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangelogProject_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangelogProject_repo_key" ON "ChangelogProject"("repo");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredBot_heartbeatToken_key" ON "MonitoredBot"("heartbeatToken");

