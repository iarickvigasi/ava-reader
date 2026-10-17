-- Generated EPUB provenance is separate from PDF jobs; portable IDs never grant ownership.
ALTER TABLE "BookProcessingRun" ADD CONSTRAINT "canonical_epub_run_scope" CHECK (
 pipeline <> 'normalize-canonical-epub-v1' OR
 ("canonicalContentId" IS NOT NULL AND "canonicalOwnerId" IS NOT NULL AND "canonicalLibraryItemId" IS NOT NULL
  AND "sourceFileId" IS NOT NULL AND "attemptCount" BETWEEN 0 AND 3 AND "attemptFence">=0));
CREATE FUNCTION ava_canonical_epub_lifecycle_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='BookProcessingRun' THEN
  IF OLD.pipeline='normalize-canonical-epub-v1' AND (
   (NEW.pipeline,NEW."bookId",NEW."sourceFileId",NEW."canonicalContentId",NEW."canonicalOwnerId",NEW."canonicalLibraryItemId")
    IS DISTINCT FROM (OLD.pipeline,OLD."bookId",OLD."sourceFileId",OLD."canonicalContentId",OLD."canonicalOwnerId",OLD."canonicalLibraryItemId")
   OR (OLD.status IN ('READY','FAILED') AND NEW IS DISTINCT FROM OLD))
  THEN RAISE EXCEPTION 'Canonical EPUB run identity/outcome is immutable'; END IF;
 ELSIF TG_OP='DELETE' THEN
  IF TG_TABLE_NAME='CanonicalEpubImport' THEN
   IF EXISTS(SELECT 1 FROM "User" WHERE id=OLD."ownerId")
    AND EXISTS(SELECT 1 FROM "Book" WHERE id=OLD."bookId")
    AND EXISTS(SELECT 1 FROM "LibraryItem" WHERE id=OLD."libraryItemId")
   THEN RAISE EXCEPTION 'Live canonical EPUB provenance cannot be deleted'; END IF;
  ELSIF EXISTS(SELECT 1 FROM "CanonicalEpubImport" WHERE id=OLD."importId") THEN
   RAISE EXCEPTION 'Live canonical EPUB attachment cannot be deleted';
  END IF;
  RETURN OLD;
 ELSIF TG_TABLE_NAME='CanonicalEpubImport' THEN
  IF NOT EXISTS(SELECT 1 FROM "BookProcessingRun" r WHERE r."bookId"=NEW."bookId"
   AND r."sourceFileId"=NEW."sourceFileId" AND r."canonicalContentId"=NEW."finalContentId"
   AND r."canonicalOwnerId"=NEW."ownerId" AND r."canonicalLibraryItemId"=NEW."libraryItemId"
   AND r.pipeline='normalize-canonical-epub-v1' AND r.status='PROCESSING'
   AND r."leaseExpiresAt">clock_timestamp() AND r."activeDeadlineAt">clock_timestamp())
   OR EXISTS(SELECT 1 FROM "PdfImportOperation" WHERE "bookId"=NEW."bookId")
  THEN RAISE EXCEPTION 'Canonical EPUB preparation authority is not live'; END IF;
 ELSIF TG_TABLE_NAME='CanonicalEpubResource' THEN
  IF EXISTS(SELECT 1 FROM "CanonicalEpubAcceptance" WHERE "importId"=NEW."importId")
   OR NOT EXISTS(SELECT 1 FROM "StoredBlob" b WHERE b.id=NEW."blobId" AND b.checksum=NEW.sha256
    AND b."sizeBytes"=NEW."byteLength" AND octet_length(b.bytes)=NEW."byteLength" AND b."mimeType"=NEW."mediaType")
  THEN RAISE EXCEPTION 'Canonical EPUB resource descriptor mismatch'; END IF;
 ELSIF TG_TABLE_NAME='CanonicalEpubAcceptance' THEN
  IF NOT EXISTS(SELECT 1 FROM "CanonicalEpubImport" i JOIN "BookProcessingRun" r ON r."canonicalContentId"=i."finalContentId"
   JOIN "PdfReaderQualification" q ON q.id=NEW."qualificationId"
   WHERE i.id=NEW."importId" AND r.status='READY' AND r."outputFileId"=i."readerFileId"
    AND r."canonicalOwnerId"=i."ownerId" AND r."canonicalLibraryItemId"=i."libraryItemId"
    AND r."leaseExpiresAt" IS NULL AND q."revokedAt" IS NULL AND q."schemaVersion"='ava-reader-3'
    AND jsonb_typeof(i."validationReport"->'required_capabilities')='array'
    AND jsonb_array_length(i."validationReport"->'required_capabilities')>0
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(i."validationReport"->'required_capabilities') c
     WHERE NOT c.value=ANY(q.capabilities)))
  THEN RAISE EXCEPTION 'Canonical EPUB acceptance is not qualified'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_epub_run_guard BEFORE UPDATE ON "BookProcessingRun" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_lifecycle_guard();
CREATE TRIGGER canonical_epub_import_lifecycle BEFORE INSERT OR DELETE ON "CanonicalEpubImport" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_lifecycle_guard();
CREATE TRIGGER canonical_epub_resource_lifecycle BEFORE INSERT OR DELETE ON "CanonicalEpubResource" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_lifecycle_guard();
CREATE TRIGGER canonical_epub_acceptance_lifecycle BEFORE INSERT OR DELETE ON "CanonicalEpubAcceptance" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_lifecycle_guard();
CREATE FUNCTION ava_canonical_epub_bytes_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='StoredBlob' THEN
  IF (NEW.bytes,NEW.checksum,NEW."sizeBytes",NEW."mimeType") IS DISTINCT FROM (OLD.bytes,OLD.checksum,OLD."sizeBytes",OLD."mimeType")
   AND (EXISTS(SELECT 1 FROM "CanonicalEpubResource" WHERE "blobId"=OLD.id)
    OR EXISTS(SELECT 1 FROM "BookFile" f JOIN "Book" b ON b.id=f."bookId" WHERE f."blobId"=OLD.id AND b."canonicalImportPrivate"))
  THEN RAISE EXCEPTION 'Canonical EPUB bytes are immutable'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM "Book" WHERE id=OLD."bookId" AND "canonicalImportPrivate")
   AND (NEW."bookId",NEW."blobId",NEW.kind,NEW.format) IS DISTINCT FROM (OLD."bookId",OLD."blobId",OLD.kind,OLD.format)
  THEN RAISE EXCEPTION 'Canonical EPUB file identity is immutable'; END IF;
  IF OLD."processingStatus"='READY' AND EXISTS(SELECT 1 FROM "CanonicalEpubImport" i JOIN "CanonicalEpubAcceptance" a ON a."importId"=i.id WHERE i."readerFileId"=OLD.id)
   AND (NEW."isPrimary",NEW."processingStatus") IS DISTINCT FROM (OLD."isPrimary",OLD."processingStatus")
  THEN RAISE EXCEPTION 'Accepted canonical EPUB cannot be replaced'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_epub_blob_bytes BEFORE UPDATE ON "StoredBlob" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_bytes_guard();
CREATE TRIGGER canonical_epub_file_bytes BEFORE UPDATE ON "BookFile" FOR EACH ROW EXECUTE FUNCTION ava_canonical_epub_bytes_guard();
