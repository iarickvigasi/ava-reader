ALTER TABLE "Book"
ADD COLUMN "authors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Book"
SET "authors" = ARRAY["author"]
WHERE "author" IS NOT NULL
  AND btrim("author") <> '';

ALTER TABLE "Book"
DROP COLUMN "author";
