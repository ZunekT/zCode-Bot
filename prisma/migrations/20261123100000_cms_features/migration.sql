-- AlterTable
ALTER TABLE "CmsSite" ADD COLUMN     "announcement" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "draft" JSONB,
ADD COLUMN     "draftAt" TIMESTAMP(3),
ADD COLUMN     "draftBy" TEXT,
ADD COLUMN     "isSelf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenance" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "previewToken" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "redirects" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "scheduledBy" TEXT,
ADD COLUMN     "stateRev" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trackId" TEXT;

-- CreateTable
CREATE TABLE "CmsSiteMember" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" TEXT[],
    "sections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsSiteMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsStat" (
    "siteId" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CmsStat_pkey" PRIMARY KEY ("siteId","day","path")
);

-- CreateTable
CREATE TABLE "CmsStatRef" (
    "siteId" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CmsStatRef_pkey" PRIMARY KEY ("siteId","day","source")
);

-- CreateIndex
CREATE INDEX "CmsSiteMember_userId_idx" ON "CmsSiteMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsSiteMember_siteId_userId_key" ON "CmsSiteMember"("siteId", "userId");

-- CreateIndex
CREATE INDEX "CmsStat_siteId_day_idx" ON "CmsStat"("siteId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "CmsSite_trackId_key" ON "CmsSite"("trackId");

-- CreateIndex
CREATE INDEX "CmsSite_scheduledAt_idx" ON "CmsSite"("scheduledAt");

-- AddForeignKey
ALTER TABLE "CmsSiteMember" ADD CONSTRAINT "CmsSiteMember_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CmsSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;


UPDATE "CmsSite" SET "previewToken" = md5(random()::text || id::text) || md5(random()::text), "trackId" = substr(md5(random()::text || id::text), 1, 16) WHERE "previewToken" = '';
