-- Privacy must survive account deletion, which removes operation records but can retain Book bytes.
ALTER TABLE "Book" ADD COLUMN "pdfImportPrivate" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Book" b SET "pdfImportPrivate"=true WHERE
  EXISTS (SELECT 1 FROM "PdfImportOperation" o WHERE o."bookId"=b.id)
  OR EXISTS (SELECT 1 FROM "StoredBlob" cover WHERE cover.id=b."coverBlobId"
    AND cover.purpose='PDF_ARTIFACT');

CREATE FUNCTION "guardPdfBookPrivacy"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."pdfImportPrivate" AND NOT NEW."pdfImportPrivate"
  THEN RAISE EXCEPTION 'PDF import privacy cannot be removed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "permanentPdfBookPrivacy" BEFORE UPDATE OF "pdfImportPrivate" ON "Book"
FOR EACH ROW EXECUTE FUNCTION "guardPdfBookPrivacy"();

CREATE FUNCTION "requirePdfBookPrivacy"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Book" WHERE id=NEW."bookId" AND "pdfImportPrivate")
  THEN RAISE EXCEPTION 'PDF import requires a private Book'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "privatePdfImportBook" BEFORE INSERT OR UPDATE ON "PdfImportOperation"
FOR EACH ROW EXECUTE FUNCTION "requirePdfBookPrivacy"();
