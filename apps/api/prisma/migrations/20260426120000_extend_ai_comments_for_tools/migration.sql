-- CreateEnum
CREATE TYPE "public"."AiCommentKind" AS ENUM ('TRANSLATE', 'ETYMOLOGY', 'EXPLAIN');

-- AlterTable: add new columns. Existing rows (if any) need defaults so the
-- NOT NULL constraints succeed; we drop the defaults afterwards so future
-- inserts must provide values explicitly.
ALTER TABLE "public"."AiComment"
ADD COLUMN "kind" "public"."AiCommentKind" NOT NULL DEFAULT 'EXPLAIN',
ADD COLUMN "sourceText" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sourceHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN "targetLang" TEXT,
ADD COLUMN "model" TEXT NOT NULL DEFAULT '',
ADD COLUMN "body" TEXT NOT NULL DEFAULT '';

ALTER TABLE "public"."AiComment"
ALTER COLUMN "kind" DROP DEFAULT,
ALTER COLUMN "sourceText" DROP DEFAULT,
ALTER COLUMN "sourceHash" DROP DEFAULT,
ALTER COLUMN "model" DROP DEFAULT,
ALTER COLUMN "body" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "AiComment_userId_sourceHash_key" ON "public"."AiComment"("userId", "sourceHash");

-- CreateIndex
CREATE INDEX "AiComment_userId_libraryItemId_kind_createdAt_idx" ON "public"."AiComment"("userId", "libraryItemId", "kind", "createdAt");
