-- AlterTable
ALTER TABLE "SdkBotMember" ADD COLUMN     "guilds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY[]::TEXT[];
