-- AlterTable
ALTER TABLE "GuildConfig" DROP COLUMN "suggestionChannelId",
DROP COLUMN "welcomeChannelId";

-- DropTable
DROP TABLE "Snippet";

-- DropTable
DROP TABLE "Suggestion";

-- DropEnum
DROP TYPE "SuggestionStatus";

