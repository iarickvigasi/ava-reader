CREATE FUNCTION ava_cancel_canonical_epub_import() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "BookProcessingRun" SET status='FAILED', "completedAt"=clock_timestamp(),
  "errorMessage"='The EPUB could not be prepared.', "leaseExpiresAt"=NULL, "leaseTokenHash"=NULL
 WHERE pipeline='normalize-canonical-epub-v1' AND "canonicalLibraryItemId"=OLD.id
  AND status IN ('PENDING','PROCESSING');
 RETURN OLD;
END $$;
CREATE TRIGGER canonical_epub_cancel_deleted_item BEFORE DELETE ON "LibraryItem"
 FOR EACH ROW EXECUTE FUNCTION ava_cancel_canonical_epub_import();
