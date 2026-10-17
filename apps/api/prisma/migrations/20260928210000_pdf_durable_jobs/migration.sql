-- CreateEnum
CREATE TYPE "PdfJobState" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'FAILED', 'STOPPED');

-- CreateEnum
CREATE TYPE "PdfAttemptState" AS ENUM ('RUNNING', 'EXPIRED', 'RETRY', 'CANDIDATE', 'FAILED', 'STOPPED', 'WAITING');

-- AlterTable
ALTER TABLE "PdfImportOperation" ADD COLUMN     "failureId" TEXT,
ADD COLUMN     "progressCompleted" INTEGER,
ADD COLUMN     "progressTotal" INTEGER;

-- AlterTable
ALTER TABLE "PdfArtifact" ADD COLUMN     "attemptId" TEXT,
ADD COLUMN     "descriptorId" TEXT;

-- CreateTable
CREATE TABLE "PdfWorkerPrincipal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "workerFingerprint" TEXT NOT NULL,
    "modes" TEXT[] DEFAULT ARRAY['native']::TEXT[],
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfWorkerPrincipal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfConversionJob" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "state" "PdfJobState" NOT NULL DEFAULT 'QUEUED',
    "policy" JSONB NOT NULL,
    "policySha256" TEXT NOT NULL,
    "providerMode" TEXT NOT NULL DEFAULT 'native',
    "workerFingerprint" TEXT,
    "attemptFence" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "currentAttemptId" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "waitReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfConversionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfJobAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "fence" INTEGER NOT NULL,
    "attemptTokenHash" TEXT NOT NULL,
    "status" "PdfAttemptState" NOT NULL DEFAULT 'RUNNING',
    "jobInput" JSONB NOT NULL,
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "resultSha256" TEXT,
    "result" JSONB,
    "artifactMap" JSONB,
    "failureCode" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'PREFLIGHT',
    "progressCompleted" INTEGER,
    "progressTotal" INTEGER,

    CONSTRAINT "PdfJobAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfJobFailure" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "attemptId" TEXT,
    "stage" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "safeReason" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "configSha256" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "cancellationEpoch" INTEGER NOT NULL,
    "attemptFence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfJobFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfNotificationIntent" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "failureId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'pdf_import_failed',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "PdfNotificationIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdfConversionJob_operationId_key" ON "PdfConversionJob"("operationId");

-- CreateIndex
CREATE INDEX "PdfConversionJob_state_availableAt_createdAt_idx" ON "PdfConversionJob"("state", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "PdfJobAttempt_status_leaseExpiresAt_idx" ON "PdfJobAttempt"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "PdfJobAttempt_principalId_status_idx" ON "PdfJobAttempt"("principalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PdfJobAttempt_jobId_fence_key" ON "PdfJobAttempt"("jobId", "fence");

-- CreateIndex
CREATE UNIQUE INDEX "PdfJobFailure_operationId_key" ON "PdfJobFailure"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfNotificationIntent_operationId_key" ON "PdfNotificationIntent"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfNotificationIntent_failureId_key" ON "PdfNotificationIntent"("failureId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfArtifact_attemptId_descriptorId_key" ON "PdfArtifact"("attemptId", "descriptorId");

-- AddForeignKey
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "PdfArtifact_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PdfJobAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfConversionJob" ADD CONSTRAINT "PdfConversionJob_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfJobAttempt" ADD CONSTRAINT "PdfJobAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PdfConversionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfJobAttempt" ADD CONSTRAINT "PdfJobAttempt_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "PdfWorkerPrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfJobFailure" ADD CONSTRAINT "PdfJobFailure_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfJobFailure" ADD CONSTRAINT "PdfJobFailure_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PdfJobAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfNotificationIntent" ADD CONSTRAINT "PdfNotificationIntent_failureId_fkey" FOREIGN KEY ("failureId") REFERENCES "PdfJobFailure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfNotificationIntent" ADD CONSTRAINT "PdfNotificationIntent_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing accepted, live queued operations acquire a durable native job exactly once.
INSERT INTO "PdfConversionJob" (id,"operationId",state,policy,"policySha256","updatedAt")
SELECT 'pdf06-'||id,id,'QUEUED','{"version":1,"maxAttempts":3,"leaseMs":30000,"totalTimeoutMs":1800000,"retryDelayMs":1000,"globalConcurrency":2,"ownerConcurrency":1,"principalConcurrency":1,"globalQueueLimit":100,"ownerQueueLimit":10,"scratchByteLimit":2147483648}'::jsonb,'86831140f8381507620f41826857fd72ae00ebd365a147995ce6b0685a8f6dc9',CURRENT_TIMESTAMP
FROM "PdfImportOperation" WHERE status='QUEUED' AND "deletedAt" IS NULL
ON CONFLICT ("operationId") DO NOTHING;
-- A current lease is unique; history remains for recovery and investigation.
CREATE UNIQUE INDEX "pdf_one_running_attempt" ON "PdfJobAttempt" ("jobId") WHERE status='RUNNING';
ALTER TABLE "PdfConversionJob" ADD CONSTRAINT "pdf_job_bounds" CHECK
  ("attemptFence">=0 AND "attemptCount">=0 AND "attemptCount"<=3 AND "providerMode" IN ('native','stub','replay'));
ALTER TABLE "PdfArtifact" ADD CONSTRAINT "pdf_attempt_descriptor_pair" CHECK
  (("attemptId" IS NULL)=("descriptorId" IS NULL));
ALTER TABLE "PdfJobAttempt" ADD CONSTRAINT "pdf_attempt_bounds" CHECK
  (fence>0 AND length("attemptTokenHash")=64 AND "leaseExpiresAt"<="deadlineAt");

CREATE FUNCTION "guardPdfWorkerIdentity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW."tokenHash",NEW."workerFingerprint",NEW.modes,NEW."createdAt") IS DISTINCT FROM
     (OLD.id,OLD."tokenHash",OLD."workerFingerprint",OLD.modes,OLD."createdAt") OR
     (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt")
  THEN RAISE EXCEPTION 'PDF worker identity is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfWorker" BEFORE UPDATE ON "PdfWorkerPrincipal"
FOR EACH ROW EXECUTE FUNCTION "guardPdfWorkerIdentity"();

CREATE FUNCTION "guardPdfJobIdentity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW."operationId",NEW.policy,NEW."policySha256",NEW."providerMode") IS DISTINCT FROM
     (OLD.id,OLD."operationId",OLD.policy,OLD."policySha256",OLD."providerMode") OR
     (OLD."workerFingerprint" IS NOT NULL AND NEW."workerFingerprint" IS DISTINCT FROM OLD."workerFingerprint") OR
     NEW."attemptFence"<OLD."attemptFence" OR NEW."attemptCount"<OLD."attemptCount" OR
     (OLD."deadlineAt" IS NOT NULL AND NEW."deadlineAt" IS DISTINCT FROM OLD."deadlineAt") OR
     (OLD.state IN ('FAILED','STOPPED') AND NEW IS DISTINCT FROM OLD)
  THEN RAISE EXCEPTION 'PDF job identity is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfJob" BEFORE UPDATE ON "PdfConversionJob"
FOR EACH ROW EXECUTE FUNCTION "guardPdfJobIdentity"();

CREATE FUNCTION "guardPdfAttemptIdentity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW."jobId",NEW."principalId",NEW.fence,NEW."attemptTokenHash",NEW."jobInput",NEW."deadlineAt",NEW."startedAt")
    IS DISTINCT FROM (OLD.id,OLD."jobId",OLD."principalId",OLD.fence,OLD."attemptTokenHash",OLD."jobInput",OLD."deadlineAt",OLD."startedAt") OR
    (OLD.status<>'RUNNING' AND NEW IS DISTINCT FROM OLD) OR NEW."leaseExpiresAt"<OLD."leaseExpiresAt" OR
    (OLD."resultSha256" IS NOT NULL AND (NEW."resultSha256",NEW.result,NEW."artifactMap") IS DISTINCT FROM
      (OLD."resultSha256",OLD.result,OLD."artifactMap"))
  THEN RAISE EXCEPTION 'PDF attempt identity is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfAttempt" BEFORE UPDATE ON "PdfJobAttempt"
FOR EACH ROW EXECUTE FUNCTION "guardPdfAttemptIdentity"();

CREATE FUNCTION "guardPdfAttemptArtifact"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD."attemptId" IS NOT NULL AND (NEW."attemptId",NEW."descriptorId") IS DISTINCT FROM
    (OLD."attemptId",OLD."descriptorId") THEN RAISE EXCEPTION 'PDF artifact attempt is immutable'; END IF;
  IF NEW."attemptId" IS NOT NULL AND (TG_OP='INSERT' OR OLD."attemptId" IS NULL) AND NOT EXISTS (
    SELECT 1 FROM "PdfJobAttempt" a JOIN "PdfConversionJob" j ON j.id=a."jobId"
    JOIN "PdfImportOperation" o ON o.id=j."operationId" JOIN "PdfWorkerPrincipal" p ON p.id=a."principalId"
    WHERE a.id=NEW."attemptId" AND o.id=NEW."operationId" AND o."ownerId"=NEW."ownerId"
      AND j."currentAttemptId"=a.id AND j."attemptFence"=a.fence AND j.state='RUNNING'
      AND a.status='RUNNING' AND o.status='RUNNING' AND o."deletedAt" IS NULL AND p."revokedAt" IS NULL
      AND a."leaseExpiresAt">clock_timestamp() AND a."deadlineAt">clock_timestamp()
      AND (a."jobInput"->>'generation')::int=o.generation
      AND (a."jobInput"->>'cancellation_epoch')::int=o."cancellationEpoch")
  THEN RAISE EXCEPTION 'PDF artifact attempt authority is invalid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ownedPdfAttemptArtifact" BEFORE INSERT OR UPDATE ON "PdfArtifact"
FOR EACH ROW EXECUTE FUNCTION "guardPdfAttemptArtifact"();

CREATE FUNCTION "guardPdfFailureReceipt"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'PDF failure receipt is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "PdfImportOperation" o WHERE o.id=NEW."operationId"
    AND o."sourceSha256"=NEW."sourceSha256" AND o."configSha256"=NEW."configSha256"
    AND o.generation=NEW.generation AND o."cancellationEpoch"=NEW."cancellationEpoch") OR
    (NEW."attemptId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PdfJobAttempt" a
      JOIN "PdfConversionJob" j ON j.id=a."jobId" WHERE a.id=NEW."attemptId"
      AND j."operationId"=NEW."operationId" AND a.fence=NEW."attemptFence"))
  THEN RAISE EXCEPTION 'PDF failure ownership is invalid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ownedPdfFailureReceipt" BEFORE INSERT OR UPDATE ON "PdfJobFailure"
FOR EACH ROW EXECUTE FUNCTION "guardPdfFailureReceipt"();

CREATE FUNCTION "guardPdfNotificationIntent"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "PdfJobFailure" f WHERE f.id=NEW."failureId" AND f."operationId"=NEW."operationId") OR
    (TG_OP='UPDATE' AND (NEW.id,NEW."operationId",NEW."failureId",NEW.kind,NEW."createdAt") IS DISTINCT FROM
      (OLD.id,OLD."operationId",OLD."failureId",OLD.kind,OLD."createdAt"))
  THEN RAISE EXCEPTION 'PDF notification identity is invalid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ownedPdfNotificationIntent" BEFORE INSERT OR UPDATE ON "PdfNotificationIntent"
FOR EACH ROW EXECUTE FUNCTION "guardPdfNotificationIntent"();

CREATE OR REPLACE FUNCTION "guardPdfTerminalWrite"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('FAILED','STOPPED','READY') AND
    (NEW.status,NEW.stage,NEW.generation,NEW."finalContentId",NEW."failureId",NEW."failureCode",NEW."failureReason",
     NEW."progressCompleted",NEW."progressTotal",NEW."investigationMarkedAt",NEW."notificationPendingAt") IS DISTINCT FROM
    (OLD.status,OLD.stage,OLD.generation,OLD."finalContentId",OLD."failureId",OLD."failureCode",OLD."failureReason",
     OLD."progressCompleted",OLD."progressTotal",OLD."investigationMarkedAt",OLD."notificationPendingAt")
  THEN RAISE EXCEPTION 'Terminal PDF outcome is immutable'; END IF;
  IF NEW."failureId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PdfJobFailure" f
    WHERE f.id=NEW."failureId" AND f."operationId"=NEW.id)
  THEN RAISE EXCEPTION 'PDF failure reference is invalid'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "tombstonePdfImport"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "PdfImportOperation" SET "deletedAt"=CURRENT_TIMESTAMP,
    status=CASE WHEN status IN ('QUEUED','RUNNING','WAITING') THEN 'STOPPED'::"PdfImportStatus" ELSE status END,
    "cancellationEpoch"="cancellationEpoch"+1,"updatedAt"=CURRENT_TIMESTAMP
    WHERE "libraryItemId"=OLD.id AND "ownerId"=OLD."userId" AND "deletedAt" IS NULL;
  UPDATE "PdfJobAttempt" a SET status='STOPPED',"finishedAt"=CURRENT_TIMESTAMP FROM "PdfConversionJob" j,
    "PdfImportOperation" o WHERE a."jobId"=j.id AND j."operationId"=o.id AND o."libraryItemId"=OLD.id AND a.status='RUNNING';
  UPDATE "PdfConversionJob" j SET state='STOPPED',"waitReason"='DELETED',"updatedAt"=CURRENT_TIMESTAMP
    FROM "PdfImportOperation" o WHERE j."operationId"=o.id AND o."libraryItemId"=OLD.id AND j.state IN ('QUEUED','RUNNING','WAITING');
  RETURN OLD;
END $$;
