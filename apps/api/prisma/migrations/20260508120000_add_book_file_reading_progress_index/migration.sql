-- AlterTable: add a nullable JSONB column to BookFile that holds a compact
-- progress index for DERIVED_READER rows. Populated by the reader-processing
-- pipeline going forward and lazily back-filled on first read for legacy rows.
-- Keeping the column nullable avoids a heavy backfill at deploy time.
ALTER TABLE "public"."BookFile" ADD COLUMN "readingProgressIndex" JSONB;
