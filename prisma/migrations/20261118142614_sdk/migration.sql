-- CreateTable
CREATE TABLE "SdkBot" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "appId" TEXT,
    "username" TEXT,
    "avatarUrl" TEXT,
    "sdkVersion" TEXT,
    "botVersion" TEXT,
    "schema" JSONB,
    "commands" JSONB,
    "profile" JSONB,
    "profileRevision" INTEGER NOT NULL DEFAULT 0,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "monitoredBotId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SdkBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdkGuild" (
    "botId" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "channels" JSONB NOT NULL,
    "roles" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SdkGuild_pkey" PRIMARY KEY ("botId","guildId")
);

-- CreateTable
CREATE TABLE "SdkConfig" (
    "botId" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SdkConfig_pkey" PRIMARY KEY ("botId","guildId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SdkBot_keyHash_key" ON "SdkBot"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "SdkBot_monitoredBotId_key" ON "SdkBot"("monitoredBotId");

-- CreateIndex
CREATE INDEX "SdkBot_ownerId_idx" ON "SdkBot"("ownerId");

-- AddForeignKey
ALTER TABLE "SdkGuild" ADD CONSTRAINT "SdkGuild_botId_fkey" FOREIGN KEY ("botId") REFERENCES "SdkBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdkConfig" ADD CONSTRAINT "SdkConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "SdkBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

