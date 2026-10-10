-- Keep durable failure/notification evidence while its operation is retained.
-- Parent-row deletion is already visible when PostgreSQL executes cascading child deletes.
CREATE FUNCTION "retainPdfFailureEvidence"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PdfImportOperation" WHERE id=OLD."operationId")
  THEN RAISE EXCEPTION 'PDF failure evidence is retained with its operation'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER "retainPdfFailureReceipt" BEFORE DELETE ON "PdfJobFailure"
FOR EACH ROW EXECUTE FUNCTION "retainPdfFailureEvidence"();
CREATE TRIGGER "retainPdfNotificationIntent" BEFORE DELETE ON "PdfNotificationIntent"
FOR EACH ROW EXECUTE FUNCTION "retainPdfFailureEvidence"();
