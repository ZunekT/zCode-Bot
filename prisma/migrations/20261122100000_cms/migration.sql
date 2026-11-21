-- CreateTable
CREATE TABLE "CmsSite" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "url" TEXT,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "schema" JSONB NOT NULL DEFAULT '{"sections":[]}',
    "schemaHash" TEXT,
    "schemaAt" TIMESTAMP(3),
    "content" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "webhookUrl" TEXT,
    "lastFetchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsAsset" (
    "id" TEXT NOT NULL,
    "siteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsVersion" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsSite_keyHash_key" ON "CmsSite"("keyHash");

-- CreateIndex
CREATE INDEX "CmsSite_ownerId_idx" ON "CmsSite"("ownerId");

-- CreateIndex
CREATE INDEX "CmsAsset_siteId_idx" ON "CmsAsset"("siteId");

-- CreateIndex
CREATE INDEX "CmsVersion_siteId_revision_idx" ON "CmsVersion"("siteId", "revision");

-- AddForeignKey
ALTER TABLE "CmsAsset" ADD CONSTRAINT "CmsAsset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CmsSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsVersion" ADD CONSTRAINT "CmsVersion_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CmsSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

