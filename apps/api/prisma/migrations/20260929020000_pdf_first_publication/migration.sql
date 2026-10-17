-- AlterEnum
ALTER TYPE "PdfJobState" ADD VALUE 'SUCCEEDED';

-- AlterTable
ALTER TABLE "PdfNotificationIntent" ALTER COLUMN "failureId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PdfReaderQualification" (
    "id" TEXT NOT NULL,
    "readerBuildFingerprint" TEXT NOT NULL,
    "adapterFingerprint" TEXT NOT NULL,
    "reportSha256" TEXT NOT NULL,
    "evidenceKind" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT 'ava-reader-3',
    "capabilities" TEXT[],
    "evidence" JSONB NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfReaderQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfCandidateValidation" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "candidateResultSha256" TEXT NOT NULL,
    "validatorFingerprint" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "configSha256" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "cancellationEpoch" INTEGER NOT NULL,
    "attemptFence" INTEGER NOT NULL,
    "canonicalArtifactId" TEXT NOT NULL,
    "canonicalDigest" TEXT NOT NULL,
    "epubArtifactId" TEXT NOT NULL,
    "readerArtifactId" TEXT NOT NULL,
    "reportArtifactId" TEXT NOT NULL,
    "finalContentId" TEXT NOT NULL,
    "resourceMap" JSONB NOT NULL,
    "verdict" TEXT NOT NULL,
    "hardBlocks" TEXT[],
    "reviewFindings" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfCandidateValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfReviewDecision" (
    "id" TEXT NOT NULL,
    "validationId" TEXT NOT NULL,
    "reviewerKey" TEXT NOT NULL,
    "reviewerRole" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "approvedFindings" TEXT[],
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfPublication" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "validationId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "finalContentId" TEXT NOT NULL,
    "sourceArtifactId" TEXT NOT NULL,
    "canonicalArtifactId" TEXT NOT NULL,
    "epubArtifactId" TEXT NOT NULL,
    "readerArtifactId" TEXT NOT NULL,
    "reportArtifactId" TEXT NOT NULL,
    "resourceMap" JSONB NOT NULL,
    "acceptedBytes" BYTEA NOT NULL,
    "acceptedSha256" TEXT NOT NULL,
    "publicationFence" INTEGER NOT NULL,
    "generation" INTEGER NOT NULL,
    "cancellationEpoch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdfReaderQualification_readerBuildFingerprint_adapterFinger_key" ON "PdfReaderQualification"("readerBuildFingerprint", "adapterFingerprint", "reportSha256");

-- CreateIndex
CREATE UNIQUE INDEX "PdfCandidateValidation_finalContentId_key" ON "PdfCandidateValidation"("finalContentId");

-- CreateIndex
CREATE INDEX "PdfCandidateValidation_operationId_createdAt_idx" ON "PdfCandidateValidation"("operationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PdfCandidateValidation_attemptId_validatorFingerprint_key" ON "PdfCandidateValidation"("attemptId", "validatorFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "PdfReviewDecision_validationId_key" ON "PdfReviewDecision"("validationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfPublication_operationId_key" ON "PdfPublication"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfPublication_validationId_key" ON "PdfPublication"("validationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfPublication_finalContentId_key" ON "PdfPublication"("finalContentId");

-- AddForeignKey
ALTER TABLE "PdfCandidateValidation" ADD CONSTRAINT "PdfCandidateValidation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfReviewDecision" ADD CONSTRAINT "PdfReviewDecision_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "PdfCandidateValidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfPublication" ADD CONSTRAINT "PdfPublication_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfPublication" ADD CONSTRAINT "PdfPublication_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "PdfCandidateValidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfPublication" ADD CONSTRAINT "PdfPublication_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "PdfReaderQualification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Scope and retention are checked independently of the host publication helper.
ALTER TABLE "PdfArtifact" DROP CONSTRAINT "pdf_artifact_bounds";
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "pdf_artifact_bounds" CHECK
 ("sizeBytes">0 AND "sizeBytes"<=CASE WHEN role='DERIVED_EPUB' THEN 268435456 ELSE 209715200 END
 AND checksum ~ '^[a-f0-9]{64}$' AND (retention<>'STAGING' OR "expiresAt" IS NOT NULL));
ALTER TABLE "PdfReaderQualification" ADD CONSTRAINT "pdf_reader_qualification_shape" CHECK
 ("readerBuildFingerprint" ~ '^[a-f0-9]{64}$' AND "adapterFingerprint" ~ '^[a-f0-9]{64}$'
 AND "reportSha256" ~ '^[a-f0-9]{64}$' AND "evidenceKind" IN ('TEST','PRODUCT') AND "schemaVersion"='ava-reader-3');
ALTER TABLE "PdfCandidateValidation" ADD CONSTRAINT "pdf_validation_shape" CHECK
 (verdict IN ('PASS','REVIEW','BLOCKED') AND (verdict='BLOCKED')=(cardinality("hardBlocks")>0)
 AND (verdict<>'PASS' OR cardinality("reviewFindings")=0) AND "canonicalDigest" ~ '^[a-f0-9]{64}$'
 AND "validatorFingerprint" ~ '^[a-f0-9]{64}$');
ALTER TABLE "PdfReviewDecision" ADD CONSTRAINT "pdf_review_shape" CHECK
 (decision IN ('APPROVE','REJECT') AND "reviewerRole"='ADMIN' AND "policyVersion"='ava-pdf-review-1');
CREATE FUNCTION "guardPdfValidation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'PDF validation is immutable'; END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "PdfImportOperation" WHERE id=OLD."operationId") THEN RAISE EXCEPTION 'PDF validation is retained'; END IF;
  RETURN OLD;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "PdfImportOperation" o JOIN "PdfConversionJob" j ON j."operationId"=o.id
   JOIN "PdfJobAttempt" a ON a.id=j."currentAttemptId" JOIN "PdfWorkerPrincipal" p ON p.id=a."principalId"
   WHERE o.id=NEW."operationId" AND o.status='WAITING' AND o."deletedAt" IS NULL
    AND j.state='WAITING' AND j."waitReason"='REVIEW' AND a.status='CANDIDATE' AND p."revokedAt" IS NULL
    AND a.id=NEW."attemptId" AND a.fence=NEW."attemptFence" AND a."resultSha256"=NEW."candidateResultSha256"
    AND j."attemptFence"=NEW."attemptFence" AND o.generation=NEW.generation AND o."cancellationEpoch"=NEW."cancellationEpoch"
    AND o."sourceSha256"=NEW."sourceSha256" AND o."configSha256"=NEW."configSha256")
 THEN RAISE EXCEPTION 'PDF validation scope is stale'; END IF;
 IF (SELECT count(*) FROM "PdfArtifact" a WHERE a."operationId"=NEW."operationId" AND a.retention='OPERATION'
   AND ((a.id=NEW."canonicalArtifactId" AND a.role='CANONICAL_BOOK') OR (a.id=NEW."epubArtifactId" AND a.role='DERIVED_EPUB')
    OR (a.id=NEW."readerArtifactId" AND a.role='DERIVED_READER') OR (a.id=NEW."reportArtifactId" AND a.role='VALIDATION_REPORT')))<>4
 THEN RAISE EXCEPTION 'PDF validation artifacts mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfValidation" BEFORE INSERT OR UPDATE OR DELETE ON "PdfCandidateValidation"
 FOR EACH ROW EXECUTE FUNCTION "guardPdfValidation"();
CREATE FUNCTION "guardPdfReview"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'PDF review is immutable'; END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "PdfCandidateValidation" WHERE id=OLD."validationId") THEN RAISE EXCEPTION 'PDF review is retained'; END IF;
  RETURN OLD;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "User" WHERE id=NEW."reviewerKey" AND role='ADMIN')
  OR NOT EXISTS(SELECT 1 FROM "PdfCandidateValidation" v JOIN "PdfImportOperation" o ON o.id=v."operationId"
    WHERE v.id=NEW."validationId" AND o.status='WAITING' AND o."deletedAt" IS NULL AND cardinality(v."hardBlocks")=0
    AND (NEW.decision='REJECT' OR (NEW."approvedFindings" @> v."reviewFindings" AND NEW."approvedFindings" <@ v."reviewFindings")))
 THEN RAISE EXCEPTION 'PDF review authority invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfReview" BEFORE INSERT OR UPDATE OR DELETE ON "PdfReviewDecision"
 FOR EACH ROW EXECUTE FUNCTION "guardPdfReview"();
CREATE FUNCTION "guardPdfReaderQualification"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'revokedAt') IS DISTINCT FROM (to_jsonb(OLD)-'revokedAt') OR
   (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt")
 THEN RAISE EXCEPTION 'PDF reader qualification is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfReaderQualification" BEFORE UPDATE ON "PdfReaderQualification"
 FOR EACH ROW EXECUTE FUNCTION "guardPdfReaderQualification"();
CREATE FUNCTION "guardPdfPublication"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v "PdfCandidateValidation"; o "PdfImportOperation";
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'PDF publication is immutable'; END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "PdfImportOperation" WHERE id=OLD."operationId") THEN RAISE EXCEPTION 'PDF publication is retained'; END IF;
  RETURN OLD;
 END IF;
 SELECT * INTO v FROM "PdfCandidateValidation" WHERE id=NEW."validationId";
 SELECT * INTO o FROM "PdfImportOperation" WHERE id=NEW."operationId";
 IF v.id IS NULL OR o.id IS NULL OR o.status<>'WAITING' OR o."deletedAt" IS NOT NULL OR v."operationId"<>o.id
  OR v."finalContentId"<>NEW."finalContentId" OR v."generation"<>o.generation OR v."cancellationEpoch"<>o."cancellationEpoch"
  OR (NEW."canonicalArtifactId",NEW."epubArtifactId",NEW."readerArtifactId",NEW."reportArtifactId",NEW."resourceMap",NEW."publicationFence")
    IS DISTINCT FROM (v."canonicalArtifactId",v."epubArtifactId",v."readerArtifactId",v."reportArtifactId",v."resourceMap",v."attemptFence")
  OR NEW."sourceArtifactId"<>o."sourceArtifactId" OR NEW.generation<>v.generation OR NEW."cancellationEpoch"<>v."cancellationEpoch"
  OR v.verdict='BLOCKED' OR cardinality(v."hardBlocks")>0 OR
    (cardinality(v."reviewFindings")>0 AND NOT EXISTS(SELECT 1 FROM "PdfReviewDecision" WHERE "validationId"=v.id AND decision='APPROVE'))
  OR EXISTS(SELECT 1 FROM "PdfReviewDecision" WHERE "validationId"=v.id AND decision='REJECT')
  OR NOT EXISTS(SELECT 1 FROM "PdfReaderQualification" WHERE id=NEW."qualificationId" AND "revokedAt" IS NULL)
  OR NOT EXISTS(SELECT 1 FROM "PdfConversionJob" j JOIN "PdfJobAttempt" a ON a.id=j."currentAttemptId"
    JOIN "PdfWorkerPrincipal" p ON p.id=a."principalId" WHERE j."operationId"=o.id AND j.state='WAITING'
    AND a.id=v."attemptId" AND a.status='CANDIDATE' AND j."attemptFence"=v."attemptFence" AND p."revokedAt" IS NULL)
 THEN RAISE EXCEPTION 'PDF publication authority invalid'; END IF;
 IF encode(sha256(NEW."acceptedBytes"),'hex')<>NEW."acceptedSha256" THEN RAISE EXCEPTION 'PDF accepted bytes mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfPublication" BEFORE INSERT OR UPDATE OR DELETE ON "PdfPublication"
 FOR EACH ROW EXECUTE FUNCTION "guardPdfPublication"();
CREATE FUNCTION "assertPdfReadyPublication"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE opid text; o "PdfImportOperation"; p "PdfPublication";
BEGIN
 opid:=CASE WHEN TG_TABLE_NAME='PdfImportOperation' THEN NEW.id ELSE NEW."operationId" END;
 SELECT * INTO o FROM "PdfImportOperation" WHERE id=opid;
 IF o.id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO p FROM "PdfPublication" WHERE "operationId"=opid;
 IF (o.status='READY') IS DISTINCT FROM (p.id IS NOT NULL) OR
   (p.id IS NOT NULL AND o."finalContentId" IS DISTINCT FROM p."finalContentId")
 THEN RAISE EXCEPTION 'PDF Ready requires exactly one matching publication'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "pdfReadyHasPublication" AFTER INSERT OR UPDATE ON "PdfImportOperation"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "assertPdfReadyPublication"();
CREATE CONSTRAINT TRIGGER "pdfPublicationIsReady" AFTER INSERT ON "PdfPublication"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "assertPdfReadyPublication"();
CREATE OR REPLACE FUNCTION "guardPdfNotificationIntent"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.kind='pdf_import_failed' AND NOT EXISTS(SELECT 1 FROM "PdfJobFailure" f WHERE f.id=NEW."failureId" AND f."operationId"=NEW."operationId"))
 OR (NEW.kind='pdf_import_ready' AND (NEW."failureId" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "PdfPublication" p WHERE p."operationId"=NEW."operationId")))
 OR NEW.kind NOT IN ('pdf_import_failed','pdf_import_ready')
 OR (TG_OP='UPDATE' AND (NEW.id,NEW."operationId",NEW."failureId",NEW.kind,NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."operationId",OLD."failureId",OLD.kind,OLD."createdAt"))
 THEN RAISE EXCEPTION 'PDF notification identity is invalid'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION "retainAcceptedPdfArtifact"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.retention='ACCEPTED' AND EXISTS(SELECT 1 FROM "PdfImportOperation" WHERE id=OLD."operationId" AND "deletedAt" IS NULL)
 AND (TG_OP='DELETE' OR NEW.retention<>'ACCEPTED') THEN RAISE EXCEPTION 'Accepted PDF artifact is retained'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "retainAcceptedPdfArtifact" BEFORE UPDATE OR DELETE ON "PdfArtifact"
 FOR EACH ROW EXECUTE FUNCTION "retainAcceptedPdfArtifact"();
