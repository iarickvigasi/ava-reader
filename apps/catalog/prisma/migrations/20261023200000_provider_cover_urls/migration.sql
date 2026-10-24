ALTER TABLE "Work" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "Edition" ADD COLUMN "coverImageUrl" TEXT;
-- Existing numeric cover IDs were supplied by the Open Library adapter.
UPDATE "Work" w SET "coverImageUrl" =
  'https://covers.openlibrary.org/b/id/' || w."coverId" || '-L.jpg?default=false'
WHERE w."coverId" > 0 AND EXISTS (
  SELECT 1 FROM "SourceMapping" m JOIN "Source" s ON s.id = m."sourceId"
  WHERE m."workId" = w.id AND s.key = 'open-library'
);
UPDATE "Edition" e SET "coverImageUrl" =
  'https://covers.openlibrary.org/b/id/' || e."coverId" || '-L.jpg?default=false'
WHERE e."coverId" > 0 AND EXISTS (
  SELECT 1 FROM "SourceMapping" m JOIN "Source" s ON s.id = m."sourceId"
  WHERE m."editionId" = e.id AND s.key = 'open-library'
);
