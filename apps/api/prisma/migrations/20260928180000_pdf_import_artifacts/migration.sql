-- CreateEnum
CREATE TYPE "PdfImportStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'READY', 'FAILED', 'STOPPED');

-- CreateEnum
CREATE TYPE "PdfArtifactRole" AS ENUM ('SOURCE_PDF', 'CANONICAL_BOOK', 'DERIVED_EPUB', 'DERIVED_READER', 'VALIDATION_REPORT', 'RESOURCE', 'COVER', 'DIAGNOSTIC');

-- CreateEnum
CREATE TYPE "PdfArtifactRetention" AS ENUM ('STAGING', 'OPERATION', 'ACCEPTED');

-- AlterEnum
ALTER TYPE "BlobPurpose" ADD VALUE 'PDF_ARTIFACT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookFileFormat" ADD VALUE 'CANONICAL_JSON';
ALTER TYPE "BookFileFormat" ADD VALUE 'REPORT_JSON';
ALTER TYPE "BookFileFormat" ADD VALUE 'IMAGE';

-- AlterEnum
ALTER TYPE "BookFileKind" ADD VALUE 'DERIVED_EPUB';

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "metadataEditVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metadataUserFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PdfImportOperation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestSha256" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "configSha256" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "profileId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "sourceArtifactId" TEXT NOT NULL,
    "status" "PdfImportStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'PREFLIGHT',
    "generation" INTEGER NOT NULL DEFAULT 1,
    "cancellationEpoch" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "finalContentId" TEXT,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "investigationMarkedAt" TIMESTAMP(3),
    "notificationPendingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfImportOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfArtifact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "operationId" TEXT,
    "blobId" TEXT NOT NULL,
    "role" "PdfArtifactRole" NOT NULL,
    "retention" "PdfArtifactRetention" NOT NULL DEFAULT 'STAGING',
    "expiresAt" TIMESTAMP(3),
    "checksum" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfMetadataClaim" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "sourceSha256" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "observedVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfMetadataClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdfImportOperation_bookId_key" ON "PdfImportOperation"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfImportOperation_libraryItemId_key" ON "PdfImportOperation"("libraryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfImportOperation_sourceArtifactId_key" ON "PdfImportOperation"("sourceArtifactId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfImportOperation_finalContentId_key" ON "PdfImportOperation"("finalContentId");

-- CreateIndex
CREATE INDEX "PdfImportOperation_ownerId_sourceSha256_idx" ON "PdfImportOperation"("ownerId", "sourceSha256");

-- CreateIndex
CREATE INDEX "PdfImportOperation_status_createdAt_idx" ON "PdfImportOperation"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PdfImportOperation_ownerId_idempotencyKey_key" ON "PdfImportOperation"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PdfArtifact_blobId_key" ON "PdfArtifact"("blobId");

-- CreateIndex
CREATE INDEX "PdfArtifact_operationId_role_idx" ON "PdfArtifact"("operationId", "role");

-- CreateIndex
CREATE INDEX "PdfArtifact_retention_expiresAt_idx" ON "PdfArtifact"("retention", "expiresAt");

-- CreateIndex
CREATE INDEX "PdfMetadataClaim_operationId_field_idx" ON "PdfMetadataClaim"("operationId", "field");

-- AddForeignKey
ALTER TABLE "PdfImportOperation" ADD CONSTRAINT "PdfImportOperation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfImportOperation" ADD CONSTRAINT "PdfImportOperation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfImportOperation" ADD CONSTRAINT "PdfImportOperation_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "PdfArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "PdfArtifact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "PdfArtifact_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "StoredBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "PdfArtifact_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfMetadataClaim" ADD CONSTRAINT "PdfMetadataClaim_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Source bytes and accepted input identity never change; retention/stop state may advance.
CREATE FUNCTION "guardPdfBlobIdentity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PdfArtifact" WHERE "blobId" = OLD.id)
     AND (NEW.bytes, NEW.checksum, NEW."sizeBytes", NEW."mimeType", NEW."originalFilename")
         IS DISTINCT FROM (OLD.bytes, OLD.checksum, OLD."sizeBytes", OLD."mimeType", OLD."originalFilename")
  THEN RAISE EXCEPTION 'Pinned PDF artifact bytes are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfBlob" BEFORE UPDATE ON "StoredBlob"
FOR EACH ROW EXECUTE FUNCTION "guardPdfBlobIdentity"();

CREATE FUNCTION "guardPdfArtifactIdentity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND ((NEW."ownerId",NEW."blobId",NEW.role,NEW.checksum,NEW."sizeBytes",NEW."mimeType")
    IS DISTINCT FROM (OLD."ownerId",OLD."blobId",OLD.role,OLD.checksum,OLD."sizeBytes",OLD."mimeType")
    OR (OLD."operationId" IS NOT NULL AND NEW."operationId" IS DISTINCT FROM OLD."operationId"))
  THEN RAISE EXCEPTION 'PDF artifact identity is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "StoredBlob" b WHERE b.id=NEW."blobId" AND b.checksum=NEW.checksum
    AND b."sizeBytes"=NEW."sizeBytes" AND b."mimeType"=NEW."mimeType")
  THEN RAISE EXCEPTION 'PDF artifact manifest does not match blob'; END IF;
  IF NEW."operationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PdfImportOperation" o
    WHERE o.id=NEW."operationId" AND o."ownerId"=NEW."ownerId" AND o."deletedAt" IS NULL)
  THEN RAISE EXCEPTION 'PDF artifact operation ownership is invalid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfArtifact" BEFORE INSERT OR UPDATE ON "PdfArtifact"
FOR EACH ROW EXECUTE FUNCTION "guardPdfArtifactIdentity"();

CREATE FUNCTION "guardPdfImportIdentity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "PdfArtifact" a WHERE a.id=NEW."sourceArtifactId"
    AND a."ownerId"=NEW."ownerId" AND a.role='SOURCE_PDF' AND a.checksum=NEW."sourceSha256")
  THEN RAISE EXCEPTION 'PDF source ownership is invalid'; END IF;
  IF TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM "LibraryItem" i WHERE i.id=NEW."libraryItemId"
    AND i."userId"=NEW."ownerId" AND i."bookId"=NEW."bookId" AND i.source='IMPORTED')
  THEN RAISE EXCEPTION 'PDF library ownership is invalid'; END IF;
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  IF (NEW."ownerId",NEW."idempotencyKey",NEW."requestSha256",NEW."sourceSha256",NEW."configSha256",
      NEW.configuration,NEW."profileId",NEW."bookId",NEW."libraryItemId",NEW."sourceArtifactId")
    IS DISTINCT FROM (OLD."ownerId",OLD."idempotencyKey",OLD."requestSha256",OLD."sourceSha256",
      OLD."configSha256",OLD.configuration,OLD."profileId",OLD."bookId",OLD."libraryItemId",OLD."sourceArtifactId")
  THEN RAISE EXCEPTION 'PDF import identity is immutable'; END IF;
  IF OLD.status IN ('FAILED','READY','STOPPED') AND NEW.status IS DISTINCT FROM OLD.status
  THEN RAISE EXCEPTION 'Terminal PDF import state is immutable'; END IF;
  IF OLD."deletedAt" IS NOT NULL AND (NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt"
      OR NEW.status IS DISTINCT FROM OLD.status OR NEW."finalContentId" IS DISTINCT FROM OLD."finalContentId")
  THEN RAISE EXCEPTION 'Deleted PDF import cannot resume'; END IF;
  IF NEW."cancellationEpoch" < OLD."cancellationEpoch" OR NEW.generation < OLD.generation
  THEN RAISE EXCEPTION 'PDF import fence cannot regress'; END IF;
  IF OLD."finalContentId" IS NOT NULL AND NEW."finalContentId" IS DISTINCT FROM OLD."finalContentId"
  THEN RAISE EXCEPTION 'PDF content identity is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfImport" BEFORE INSERT OR UPDATE ON "PdfImportOperation"
FOR EACH ROW EXECUTE FUNCTION "guardPdfImportIdentity"();

-- Deletion and its stop epoch are atomic even for callers using existing item deletion.
CREATE FUNCTION "tombstonePdfImport"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "PdfImportOperation" SET "deletedAt"=CURRENT_TIMESTAMP,
    "cancellationEpoch"="cancellationEpoch"+1,"updatedAt"=CURRENT_TIMESTAMP
    WHERE "libraryItemId"=OLD.id AND "ownerId"=OLD."userId" AND "deletedAt" IS NULL;
  RETURN OLD;
END $$;
CREATE TRIGGER "tombstonePdfImportOnDeletion" BEFORE DELETE ON "LibraryItem"
FOR EACH ROW EXECUTE FUNCTION "tombstonePdfImport"();

ALTER TABLE "PdfImportOperation" ADD CONSTRAINT "pdf_import_bounds" CHECK
  (generation>=1 AND "cancellationEpoch">=0 AND length("requestSha256")=64
   AND length("sourceSha256")=64 AND length("configSha256")=64);
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "pdf_artifact_bounds" CHECK
  ("sizeBytes">0 AND "sizeBytes"<=209715200 AND length(checksum)=64
   AND (retention<>'STAGING' OR "expiresAt" IS NOT NULL));
