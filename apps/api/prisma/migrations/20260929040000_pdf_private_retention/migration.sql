-- Grace begins at actual removal, including account cascade, never original import time.
ALTER TABLE "Book" ADD COLUMN "privateOrphanedAt" TIMESTAMP(3);
ALTER TABLE "PdfImportOperation" ADD COLUMN "workPurgedAt" TIMESTAMP(3);
CREATE INDEX "Book_privateOrphanedAt_idx" ON "Book"("privateOrphanedAt");
UPDATE "Book" b SET "privateOrphanedAt"=CURRENT_TIMESTAMP
 WHERE (b."pdfImportPrivate" OR b."canonicalImportPrivate")
 AND NOT EXISTS(SELECT 1 FROM "LibraryItem" i WHERE i."bookId"=b.id);
CREATE FUNCTION "markPrivateBookOrphan"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  UPDATE "Book" b SET "privateOrphanedAt"=COALESCE("privateOrphanedAt",clock_timestamp())
   WHERE b.id=OLD."bookId" AND (b."pdfImportPrivate" OR b."canonicalImportPrivate")
   AND NOT EXISTS(SELECT 1 FROM "LibraryItem" i WHERE i."bookId"=b.id AND i.id<>OLD.id);
  RETURN OLD;
 END IF;
 UPDATE "Book" SET "privateOrphanedAt"=NULL WHERE id=NEW."bookId" AND "privateOrphanedAt" IS NOT NULL;
 RETURN NEW;
END $$;
CREATE TRIGGER "markPrivateBookOrphan" BEFORE DELETE OR INSERT ON "LibraryItem"
 FOR EACH ROW EXECUTE FUNCTION "markPrivateBookOrphan"();
CREATE TABLE "PdfImportReceipt" (
 "operationId" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "idempotencyKey" TEXT NOT NULL, "requestSha256" TEXT NOT NULL, "sourceSha256" TEXT NOT NULL,
 "configSha256" TEXT NOT NULL, "libraryItemId" TEXT NOT NULL, stage TEXT NOT NULL, "failureCode" TEXT,
 "deletedAt" TIMESTAMP(3) NOT NULL, "purgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PdfImportReceipt_ownerId_idempotencyKey_key" UNIQUE("ownerId","idempotencyKey"),
 CONSTRAINT "pdf_receipt_hashes" CHECK ("requestSha256" ~ '^[a-f0-9]{64}$' AND "sourceSha256" ~ '^[a-f0-9]{64}$' AND "configSha256" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "PdfImportReceipt_ownerId_sourceSha256_idx" ON "PdfImportReceipt"("ownerId","sourceSha256");
CREATE FUNCTION "retainPdfImportReceipt"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' OR EXISTS(SELECT 1 FROM "User" WHERE id=OLD."ownerId")
 THEN RAISE EXCEPTION 'PDF replay receipt is immutable'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER "retainPdfImportReceipt" BEFORE UPDATE OR DELETE ON "PdfImportReceipt"
 FOR EACH ROW EXECUTE FUNCTION "retainPdfImportReceipt"();
CREATE FUNCTION "archivePdfImportReceipt"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "User" WHERE id=OLD."ownerId") THEN
  IF OLD."deletedAt" IS NULL THEN RAISE EXCEPTION 'Live PDF operation is retained'; END IF;
  INSERT INTO "PdfImportReceipt" ("operationId","ownerId","idempotencyKey","requestSha256","sourceSha256","configSha256","libraryItemId",stage,"failureCode","deletedAt")
   VALUES (OLD.id,OLD."ownerId",OLD."idempotencyKey",OLD."requestSha256",OLD."sourceSha256",OLD."configSha256",OLD."libraryItemId",OLD.stage,OLD."failureCode",OLD."deletedAt");
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER "archivePdfImportReceipt" BEFORE DELETE ON "PdfImportOperation"
 FOR EACH ROW EXECUTE FUNCTION "archivePdfImportReceipt"();
CREATE FUNCTION "guardPdfPurgedWork"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM "PdfImportReceipt" WHERE "ownerId"=NEW."ownerId" AND "idempotencyKey"=NEW."idempotencyKey")
 THEN RAISE EXCEPTION 'Removed PDF request cannot be accepted again'; END IF;
 IF TG_OP='UPDATE' AND ((OLD."workPurgedAt" IS NOT NULL AND NEW."workPurgedAt" IS DISTINCT FROM OLD."workPurgedAt")
  OR (NEW."workPurgedAt" IS NOT NULL AND NEW.status<>'FAILED'))
 THEN RAISE EXCEPTION 'PDF work cleanup marker is invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "guardPdfPurgedWork" BEFORE INSERT OR UPDATE ON "PdfImportOperation"
 FOR EACH ROW EXECUTE FUNCTION "guardPdfPurgedWork"();
-- Defer cyclic source/attempt references until the entire operation cascade finishes.
ALTER TABLE "PdfArtifact" DROP CONSTRAINT "PdfArtifact_operationId_fkey";
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "PdfArtifact_operationId_fkey" FOREIGN KEY("operationId") REFERENCES "PdfImportOperation"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfImportOperation" DROP CONSTRAINT "PdfImportOperation_sourceArtifactId_fkey";
ALTER TABLE "PdfImportOperation" ADD CONSTRAINT "PdfImportOperation_sourceArtifactId_fkey" FOREIGN KEY("sourceArtifactId") REFERENCES "PdfArtifact"(id) ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PdfArtifact" DROP CONSTRAINT "PdfArtifact_attemptId_fkey";
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "PdfArtifact_attemptId_fkey" FOREIGN KEY("attemptId") REFERENCES "PdfJobAttempt"(id) ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PdfJobFailure" DROP CONSTRAINT "PdfJobFailure_attemptId_fkey";
ALTER TABLE "PdfJobFailure" ADD CONSTRAINT "PdfJobFailure_attemptId_fkey" FOREIGN KEY("attemptId") REFERENCES "PdfJobAttempt"(id) ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
CREATE OR REPLACE FUNCTION "retainOwnedPdfProviderPayload"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "User" WHERE id=OLD."ownerId") AND EXISTS (
  SELECT 1 FROM "PdfProviderCall" c JOIN "PdfProviderGrant" g ON g.id=c."grantId"
  JOIN "PdfImportOperation" o ON o.id=g."operationId"
  WHERE c.id=OLD."callId" AND o."deletedAt" IS NULL AND o."workPurgedAt" IS NULL)
 THEN RAISE EXCEPTION 'Live PDF provider checkpoint cannot be deleted'; END IF;
 RETURN OLD;
END $$;
