-- Review hardening: terminal failure cannot acquire content or new worker artifacts.
-- The prior migration was already exercised against the disposable test database.
ALTER TABLE "PdfImportOperation" ADD CONSTRAINT "pdf_import_content_state"
CHECK ((status='READY') = ("finalContentId" IS NOT NULL));

CREATE FUNCTION "guardPdfTerminalWrite"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('FAILED','STOPPED','READY') AND
    (NEW.status,NEW.stage,NEW.generation,NEW."finalContentId",NEW."failureCode",NEW."failureReason")
    IS DISTINCT FROM
    (OLD.status,OLD.stage,OLD.generation,OLD."finalContentId",OLD."failureCode",OLD."failureReason")
  THEN RAISE EXCEPTION 'Terminal PDF outcome is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfTerminalOutcome" BEFORE UPDATE ON "PdfImportOperation"
FOR EACH ROW EXECUTE FUNCTION "guardPdfTerminalWrite"();

CREATE FUNCTION "guardPdfNewArtifact"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."operationId" IS NOT NULL AND (TG_OP='INSERT' OR OLD."operationId" IS NULL)
    AND NOT EXISTS (SELECT 1 FROM "PdfImportOperation" WHERE id=NEW."operationId"
      AND "deletedAt" IS NULL AND status IN ('QUEUED','RUNNING','WAITING'))
  THEN RAISE EXCEPTION 'Terminal or deleted PDF import cannot receive artifacts'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "activePdfArtifactAttachment" BEFORE INSERT OR UPDATE ON "PdfArtifact"
FOR EACH ROW EXECUTE FUNCTION "guardPdfNewArtifact"();
