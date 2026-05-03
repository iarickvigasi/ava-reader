-- AlterTable: add slug column nullable, backfill with id, then make NOT NULL.
-- Backfilling with the cuid id keeps existing /app/read/<id> URLs resolvable
-- while new uploads receive transliterated slugs from application code.
ALTER TABLE "public"."LibraryItem" ADD COLUMN "slug" TEXT;

UPDATE "public"."LibraryItem" SET "slug" = "id" WHERE "slug" IS NULL;

ALTER TABLE "public"."LibraryItem" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_userId_slug_key" ON "public"."LibraryItem"("userId", "slug");
