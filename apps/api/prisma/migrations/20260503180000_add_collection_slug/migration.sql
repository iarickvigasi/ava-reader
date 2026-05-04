-- AlterTable: add slug column nullable, backfill with id, then make NOT NULL.
-- Backfilling with the cuid id keeps existing /app/library/collections/<id>
-- URLs resolvable while a follow-up application script rewrites the slugs to
-- transliterated forms derived from each collection's name.
ALTER TABLE "public"."Collection" ADD COLUMN "slug" TEXT;

UPDATE "public"."Collection" SET "slug" = "id" WHERE "slug" IS NULL;

ALTER TABLE "public"."Collection" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_slug_key" ON "public"."Collection"("userId", "slug");
