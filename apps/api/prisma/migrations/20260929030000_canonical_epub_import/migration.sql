ALTER TABLE "Book" ADD COLUMN "canonicalImportPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BookProcessingRun"
 ADD COLUMN "canonicalContentId" TEXT,
 ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "attemptFence" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "leaseTokenHash" TEXT,
 ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
 ADD COLUMN "activeDeadlineAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "BookProcessingRun_canonicalContentId_key" ON "BookProcessingRun"("canonicalContentId");
CREATE TABLE "CanonicalEpubImport" (
 "id" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "bookId" TEXT NOT NULL UNIQUE REFERENCES "Book"("id") ON DELETE CASCADE,
 "libraryItemId" TEXT NOT NULL UNIQUE REFERENCES "LibraryItem"("id") ON DELETE CASCADE,
 "sourceFileId" TEXT NOT NULL UNIQUE REFERENCES "BookFile"("id") ON DELETE RESTRICT,
 "sourceSha256" TEXT NOT NULL, "readerFileId" TEXT NOT NULL UNIQUE REFERENCES "BookFile"("id") ON DELETE RESTRICT,
 "readerSha256" TEXT NOT NULL, "finalContentId" TEXT NOT NULL UNIQUE,
 "canonicalDigest" TEXT NOT NULL, "validatorFingerprint" TEXT NOT NULL,
 "validationReport" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CanonicalEpubImport_hashes" CHECK ("sourceSha256" ~ '^[a-f0-9]{64}$' AND "readerSha256" ~ '^[a-f0-9]{64}$' AND "canonicalDigest" ~ '^[a-f0-9]{64}$' AND "validatorFingerprint" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "CanonicalEpubImport_ownerId_idx" ON "CanonicalEpubImport"("ownerId");
CREATE TABLE "CanonicalEpubResource" (
 "id" TEXT PRIMARY KEY, "importId" TEXT NOT NULL REFERENCES "CanonicalEpubImport"("id") ON DELETE CASCADE,
 "resourceId" TEXT NOT NULL, "blobId" TEXT NOT NULL REFERENCES "StoredBlob"("id") ON DELETE RESTRICT,
 "sha256" TEXT NOT NULL, "mediaType" TEXT NOT NULL, "byteLength" INTEGER NOT NULL,
 CONSTRAINT "CanonicalEpubResource_identity" UNIQUE ("importId", "resourceId"),
 CONSTRAINT "CanonicalEpubResource_bounds" CHECK ("sha256" ~ '^[a-f0-9]{64}$' AND "byteLength">0 AND "byteLength"<=209715200 AND "mediaType" IN ('image/png','image/jpeg'))
);
CREATE INDEX "CanonicalEpubResource_blobId_idx" ON "CanonicalEpubResource"("blobId");
CREATE TABLE "CanonicalEpubAcceptance" (
 "id" TEXT PRIMARY KEY, "importId" TEXT NOT NULL UNIQUE REFERENCES "CanonicalEpubImport"("id") ON DELETE CASCADE,
 "qualificationId" TEXT NOT NULL REFERENCES "PdfReaderQualification"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION ava_canonical_epub_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Canonical EPUB provenance is immutable'; END IF;
 IF TG_TABLE_NAME='CanonicalEpubImport' THEN
  IF NOT EXISTS (SELECT 1 FROM "LibraryItem" i JOIN "Book" b ON b.id=i."bookId"
   JOIN "BookFile" s ON s.id=NEW."sourceFileId" JOIN "StoredBlob" sb ON sb.id=s."blobId"
   JOIN "BookFile" r ON r.id=NEW."readerFileId" JOIN "StoredBlob" rb ON rb.id=r."blobId"
   WHERE i.id=NEW."libraryItemId" AND i."userId"=NEW."ownerId" AND b.id=NEW."bookId"
    AND b."canonicalImportPrivate" AND s."bookId"=b.id AND r."bookId"=b.id
    AND s.format='EPUB' AND s.kind='SOURCE' AND r.format='READER_PACKAGE' AND r.kind='DERIVED_READER'
    AND sb.checksum=NEW."sourceSha256" AND rb.checksum=NEW."readerSha256")
  THEN RAISE EXCEPTION 'Canonical EPUB source/owner mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_epub_import_guard BEFORE INSERT OR UPDATE ON "CanonicalEpubImport" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_guard();
CREATE TRIGGER canonical_epub_resource_guard BEFORE UPDATE ON "CanonicalEpubResource" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_guard();
CREATE TRIGGER canonical_epub_acceptance_guard BEFORE UPDATE ON "CanonicalEpubAcceptance" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_guard();
CREATE FUNCTION ava_canonical_epub_private_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."canonicalImportPrivate" AND NOT NEW."canonicalImportPrivate" THEN RAISE EXCEPTION 'Canonical import privacy is permanent'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_epub_private_guard BEFORE UPDATE ON "Book" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_private_guard();
