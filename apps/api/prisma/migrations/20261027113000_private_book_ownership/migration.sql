CREATE TYPE "BookVisibility" AS ENUM ('PRIVATE', 'PUBLIC');
ALTER TABLE "Book"
  ADD COLUMN "visibility" "BookVisibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "privateOwnerId" TEXT;
ALTER TABLE "Book" ADD CONSTRAINT "Book_privateOwnerId_fkey"
  FOREIGN KEY ("privateOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Book_privateOwnerId_idx" ON "Book"("privateOwnerId");

-- Assign only unambiguous importer ownership. Conflicting books stay private/unowned.
UPDATE "Book" b SET "privateOwnerId" = owners."userId"
FROM (
  SELECT "bookId", min("userId") AS "userId" FROM "LibraryItem"
  WHERE "source" = 'IMPORTED' GROUP BY "bookId"
  HAVING count(DISTINCT "userId") = 1
) owners WHERE b."id" = owners."bookId";

-- A publication pointer alone must never turn a private import into public content.
UPDATE "Book" b SET "visibility" = 'PUBLIC'
WHERE EXISTS (SELECT 1 FROM "CatalogEntry" c WHERE c."bookId" = b."id")
  AND NOT EXISTS (
    SELECT 1 FROM "LibraryItem" l WHERE l."bookId" = b."id" AND l."source" = 'IMPORTED'
  );
ALTER TABLE "Book" ADD CONSTRAINT "Book_public_has_no_private_owner"
  CHECK ("visibility" = 'PRIVATE' OR "privateOwnerId" IS NULL);
