-- Run with psql -X -v ON_ERROR_STOP=1 -f <this file> against a test database.
BEGIN;
CREATE TEMP TABLE "Book" (
  "id" TEXT PRIMARY KEY,
  "genres" TEXT[] NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT '2026-01-01'
);
INSERT INTO "Book" ("id", "genres") VALUES
  ('private', ARRAY['стосунки, психотерапія,психолог', 'стосунки']),
  ('catalog', ARRAY['Novelists, English -- Correspondence', 'Self-Help', 'English']),
  ('duplicates', ARRAY[' Fiction,fiction,, ', E'\tFantasy\n', 'Fantasy']),
  ('empty', ARRAY[]::TEXT[]),
  ('blank', ARRAY[', ,']),
  ('numbered', ARRAY['1. Interpersonal communication. 2. Interpersonal relations. 3. Nonviolence.']),
  ('mixed', ARRAY[' 1. Fiction,Fantasy. 2. History - General. ', 'Fantasy']),
  ('periods', ARRAY['U.S. history', 'Web 2.0', 'Part 2. History']),
  ('unchanged', ARRAY['Science Fiction', 'Self-Help']);

\ir ../migrations/20260929170000_split_existing_book_genres/migration.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Book" AS book
    JOIN (VALUES
      ('private', ARRAY['стосунки', 'психотерапія', 'психолог']),
      ('catalog', ARRAY['Novelists', 'English', 'Correspondence', 'Self-Help']),
      ('duplicates', ARRAY['Fiction', 'Fantasy']),
      ('empty', ARRAY[]::TEXT[]),
      ('blank', ARRAY[]::TEXT[]),
      ('numbered', ARRAY['Interpersonal communication', 'Interpersonal relations', 'Nonviolence']),
      ('mixed', ARRAY['Fiction', 'Fantasy', 'History', 'General']),
      ('periods', ARRAY['U.S. history', 'Web 2.0', 'Part 2. History']),
      ('unchanged', ARRAY['Science Fiction', 'Self-Help'])
    ) AS expected(id, genres) ON expected.id = book."id"
    WHERE book."genres" IS DISTINCT FROM expected.genres
  ) THEN
    RAISE EXCEPTION 'Unexpected backfilled genres';
  END IF;
  IF EXISTS (SELECT 1 FROM "Book" WHERE "id" IN ('empty', 'unchanged')
    AND "updatedAt" <> '2026-01-01') THEN
    RAISE EXCEPTION 'Unchanged books were modified';
  END IF;
END $$;

UPDATE "Book" SET "updatedAt" = '2026-01-01';
\ir ../migrations/20260929170000_split_existing_book_genres/migration.sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Book" WHERE "updatedAt" <> '2026-01-01') THEN
    RAISE EXCEPTION 'Backfill is not idempotent';
  END IF;
END $$;
ROLLBACK;
