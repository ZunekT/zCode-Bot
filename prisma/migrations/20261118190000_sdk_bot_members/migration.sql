-- CreateTable
CREATE TABLE "SdkBotMember" (
    "botId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" TEXT[],
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SdkBotMember_pkey" PRIMARY KEY ("botId","userId")
);

-- CreateIndex
CREATE INDEX "SdkBotMember_userId_idx" ON "SdkBotMember"("userId");

-- AddForeignKey
ALTER TABLE "SdkBotMember" ADD CONSTRAINT "SdkBotMember_botId_fkey" FOREIGN KEY ("botId") REFERENCES "SdkBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

