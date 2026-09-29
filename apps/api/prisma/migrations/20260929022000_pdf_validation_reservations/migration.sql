-- CreateTable
CREATE TABLE "PdfValidationRun" (
    "operationId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "fence" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'WAITING',
    "principalId" TEXT,
    "tokenHash" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFailureCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfValidationRun_pkey" PRIMARY KEY ("operationId")
);

-- AddForeignKey
ALTER TABLE "PdfValidationRun" ADD CONSTRAINT "PdfValidationRun_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PdfValidationRun" ADD CONSTRAINT "pdf_validation_run_bounds" CHECK
 (attempts BETWEEN 1 AND 3 AND fence>=1 AND state IN ('RUNNING','WAITING','VALIDATED','FAILED')
  AND (state='RUNNING')=("tokenHash" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
  AND ("tokenHash" IS NULL OR "tokenHash" ~ '^[a-f0-9]{64}$'));
ALTER TABLE "PdfValidationRun" ADD CONSTRAINT "pdf_validation_run_attempt_fk"
 FOREIGN KEY("attemptId") REFERENCES "PdfJobAttempt"(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PdfValidationRun" ADD CONSTRAINT "pdf_validation_run_principal_fk"
 FOREIGN KEY("principalId") REFERENCES "PdfWorkerPrincipal"(id);
CREATE FUNCTION "guardPdfValidationRun"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   IF EXISTS(SELECT 1 FROM "PdfImportOperation" WHERE id=OLD."operationId") THEN RAISE EXCEPTION 'Validation run is retained'; END IF;
   RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND ((NEW."operationId",NEW."attemptId") IS DISTINCT FROM (OLD."operationId",OLD."attemptId")
    OR NEW.attempts<OLD.attempts OR NEW.fence<OLD.fence OR NEW.attempts>OLD.attempts+1
    OR NEW.fence>OLD.fence+1 OR (NEW.attempts>OLD.attempts) IS DISTINCT FROM (NEW.fence>OLD.fence)
    OR (OLD.state IN ('VALIDATED','FAILED') AND NEW IS DISTINCT FROM OLD))
 THEN RAISE EXCEPTION 'Validation history cannot be reset'; END IF;
 IF NEW.state='RUNNING' AND NOT EXISTS(SELECT 1 FROM "PdfImportOperation" o JOIN "PdfConversionJob" j ON j."operationId"=o.id
   JOIN "PdfJobAttempt" a ON a.id=j."currentAttemptId" JOIN "PdfWorkerPrincipal" p ON p.id=NEW."principalId"
   WHERE o.id=NEW."operationId" AND o.status='WAITING' AND o."deletedAt" IS NULL AND a.id=NEW."attemptId"
   AND a.status='CANDIDATE' AND j.state='WAITING' AND j."waitReason"='REVIEW' AND p."revokedAt" IS NULL
   AND NEW."leaseExpiresAt">clock_timestamp() AND NEW."leaseExpiresAt"<=j."deadlineAt"
   AND NEW."leaseExpiresAt"<=clock_timestamp()+interval '31 seconds')
 THEN RAISE EXCEPTION 'Validation lease scope invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfValidationRun" BEFORE INSERT OR UPDATE OR DELETE ON "PdfValidationRun"
 FOR EACH ROW EXECUTE FUNCTION "guardPdfValidationRun"();
CREATE FUNCTION "freezeSucceededPdfJob"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state::text='SUCCEEDED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Published PDF job is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutableSucceededPdfJob" BEFORE UPDATE ON "PdfConversionJob"
 FOR EACH ROW EXECUTE FUNCTION "freezeSucceededPdfJob"();
