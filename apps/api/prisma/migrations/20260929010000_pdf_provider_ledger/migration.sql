-- AlterTable
ALTER TABLE "PdfConversionJob" ADD COLUMN     "dispatchAuthorizationId" TEXT;

-- AlterTable
ALTER TABLE "PdfNotificationIntent" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PdfProviderBudget" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "limitNano" BIGINT NOT NULL,
    "hardCeilingNano" BIGINT NOT NULL,
    "actualNano" BIGINT NOT NULL DEFAULT 0,
    "reservedNano" BIGINT NOT NULL DEFAULT 0,
    "baselineNano" BIGINT NOT NULL DEFAULT 0,
    "baselineEvidenceSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfProviderBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfProviderRoute" (
    "id" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "configurationSha256" TEXT NOT NULL,
    "tariff" JSONB NOT NULL,
    "tariffSha256" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfProviderRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfProviderGrant" (
    "id" TEXT NOT NULL,
    "operationId" TEXT,
    "operationKey" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "configSha256" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "budgetIds" TEXT[],
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfProviderGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfProviderCall" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "requestSha256" TEXT NOT NULL,
    "taskSha256" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "reservedAttemptId" TEXT NOT NULL,
    "dispatchAttemptId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'RESERVED',
    "reservedNano" BIGINT NOT NULL,
    "actualNano" BIGINT,
    "accountKey" TEXT NOT NULL,
    "providerGenerationId" TEXT,
    "receiptSha256" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "PdfProviderCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfProviderAllocation" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "reservedNano" BIGINT NOT NULL,
    "actualNano" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "PdfProviderAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfProviderPayload" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfProviderPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfProviderEvent" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "evidenceSha256" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdfProviderBudget_scope_scopeKey_key" ON "PdfProviderBudget"("scope", "scopeKey");

-- CreateIndex
CREATE INDEX "PdfProviderRoute_accountKey_modelId_state_idx" ON "PdfProviderRoute"("accountKey", "modelId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "PdfProviderGrant_operationId_key" ON "PdfProviderGrant"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfProviderGrant_operationKey_key" ON "PdfProviderGrant"("operationKey");

-- CreateIndex
CREATE INDEX "PdfProviderCall_state_createdAt_idx" ON "PdfProviderCall"("state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PdfProviderCall_grantId_taskId_key" ON "PdfProviderCall"("grantId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfProviderCall_accountKey_providerGenerationId_key" ON "PdfProviderCall"("accountKey", "providerGenerationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfProviderAllocation_callId_budgetId_key" ON "PdfProviderAllocation"("callId", "budgetId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfProviderPayload_blobId_key" ON "PdfProviderPayload"("blobId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfProviderPayload_callId_kind_key" ON "PdfProviderPayload"("callId", "kind");

-- AddForeignKey
ALTER TABLE "PdfConversionJob" ADD CONSTRAINT "PdfConversionJob_dispatchAuthorizationId_fkey" FOREIGN KEY ("dispatchAuthorizationId") REFERENCES "PdfProviderGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderGrant" ADD CONSTRAINT "PdfProviderGrant_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderGrant" ADD CONSTRAINT "PdfProviderGrant_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "PdfProviderRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderCall" ADD CONSTRAINT "PdfProviderCall_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "PdfProviderGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderAllocation" ADD CONSTRAINT "PdfProviderAllocation_callId_fkey" FOREIGN KEY ("callId") REFERENCES "PdfProviderCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderAllocation" ADD CONSTRAINT "PdfProviderAllocation_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "PdfProviderBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderPayload" ADD CONSTRAINT "PdfProviderPayload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderPayload" ADD CONSTRAINT "PdfProviderPayload_callId_fkey" FOREIGN KEY ("callId") REFERENCES "PdfProviderCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderPayload" ADD CONSTRAINT "PdfProviderPayload_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "StoredBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfProviderEvent" ADD CONSTRAINT "PdfProviderEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "PdfProviderCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Immutable AVA-funded accounting identities; no account/job restart resets a budget.
ALTER TABLE "PdfProviderBudget" ADD CONSTRAINT "pdf_provider_budget_bounds" CHECK
 (scope IN ('GLOBAL','ACCOUNT','MODEL','OPERATION') AND "limitNano">=0 AND "hardCeilingNano">=0
  AND "limitNano"<="hardCeilingNano" AND "actualNano">="baselineNano" AND "baselineNano">=0 AND "reservedNano">=0
  AND length("baselineEvidenceSha256")=64);
ALTER TABLE "PdfProviderCall" ADD CONSTRAINT "pdf_provider_call_bounds" CHECK
 (state IN ('RESERVED','DISPATCHING','UNCERTAIN','SETTLED','RELEASED') AND "reservedNano">0
  AND ("actualNano" IS NULL OR "actualNano">=0) AND length("requestSha256")=64 AND length("taskSha256")=64
  AND ((state='SETTLED')=("actualNano" IS NOT NULL AND "receiptSha256" IS NOT NULL AND "providerGenerationId" IS NOT NULL)));
ALTER TABLE "PdfProviderPayload" ADD CONSTRAINT "pdf_provider_payload_bounds" CHECK
 (kind IN ('REQUEST','RESPONSE') AND "sizeBytes">0 AND "sizeBytes"<=16777216 AND length(checksum)=64);

CREATE FUNCTION "retainPdfProviderAudit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PDF provider accounting history cannot be deleted'; END $$;
CREATE TRIGGER "retainPdfProviderBudget" BEFORE DELETE ON "PdfProviderBudget" FOR EACH ROW EXECUTE FUNCTION "retainPdfProviderAudit"();
CREATE TRIGGER "retainPdfProviderRoute" BEFORE DELETE ON "PdfProviderRoute" FOR EACH ROW EXECUTE FUNCTION "retainPdfProviderAudit"();
CREATE TRIGGER "retainPdfProviderGrant" BEFORE DELETE ON "PdfProviderGrant" FOR EACH ROW EXECUTE FUNCTION "retainPdfProviderAudit"();
CREATE TRIGGER "retainPdfProviderCall" BEFORE DELETE ON "PdfProviderCall" FOR EACH ROW EXECUTE FUNCTION "retainPdfProviderAudit"();
CREATE TRIGGER "retainPdfProviderAllocation" BEFORE DELETE ON "PdfProviderAllocation" FOR EACH ROW EXECUTE FUNCTION "retainPdfProviderAudit"();
CREATE TRIGGER "retainPdfProviderEvent" BEFORE DELETE OR UPDATE ON "PdfProviderEvent" FOR EACH ROW EXECUTE FUNCTION "retainPdfProviderAudit"();

CREATE FUNCTION "guardPdfProviderBudget"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.scope,NEW."scopeKey",NEW."hardCeilingNano",NEW."baselineNano",NEW."baselineEvidenceSha256",NEW."createdAt") IS DISTINCT FROM
    (OLD.id,OLD.scope,OLD."scopeKey",OLD."hardCeilingNano",OLD."baselineNano",OLD."baselineEvidenceSha256",OLD."createdAt")
    OR NEW."actualNano"<OLD."actualNano" OR NEW."limitNano">OLD."limitNano"
 THEN RAISE EXCEPTION 'PDF provider budget identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfProviderBudget" BEFORE UPDATE ON "PdfProviderBudget" FOR EACH ROW EXECUTE FUNCTION "guardPdfProviderBudget"();

CREATE FUNCTION "checkPdfProviderAllocationTotals"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key text; actual bigint; reserved bigint; budget "PdfProviderBudget"%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='PdfProviderBudget' THEN key=NEW.id; ELSE key=NEW."budgetId"; END IF;
 SELECT * INTO budget FROM "PdfProviderBudget" WHERE id=key;
 SELECT COALESCE(sum("actualNano"),0),COALESCE(sum("reservedNano"),0) INTO actual,reserved FROM "PdfProviderAllocation" WHERE "budgetId"=key;
 IF budget."actualNano"<>budget."baselineNano"+actual OR budget."reservedNano"<>reserved
 THEN RAISE EXCEPTION 'PDF provider budget totals do not match allocations'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "pdfProviderBudgetTotals" AFTER INSERT OR UPDATE ON "PdfProviderBudget"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "checkPdfProviderAllocationTotals"();
CREATE CONSTRAINT TRIGGER "pdfProviderAllocationTotals" AFTER INSERT OR UPDATE ON "PdfProviderAllocation"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "checkPdfProviderAllocationTotals"();

CREATE FUNCTION "guardPdfProviderRoute"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR (OLD.state='REVOKED' AND NEW.state<>OLD.state)
 THEN RAISE EXCEPTION 'PDF provider route identity is immutable'; END IF;
 IF NEW.state NOT IN ('ACTIVE','PAUSED_UNCERTAIN','PAUSED_OVERAGE','REVOKED')
 THEN RAISE EXCEPTION 'PDF provider route state is invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfProviderRoute" BEFORE UPDATE ON "PdfProviderRoute" FOR EACH ROW EXECUTE FUNCTION "guardPdfProviderRoute"();

CREATE FUNCTION "guardPdfProviderGrant"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-'state'-'operationId') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'operationId')
   OR (NEW."operationId" IS DISTINCT FROM OLD."operationId" AND (NEW."operationId" IS NOT NULL OR EXISTS
     (SELECT 1 FROM "PdfImportOperation" WHERE id=OLD."operationId"))) OR (OLD.state='REVOKED' AND NEW.state<>OLD.state))
 THEN RAISE EXCEPTION 'PDF provider grant identity is immutable'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM "PdfImportOperation" o WHERE o.id=NEW."operationId"
   AND o.id=NEW."operationKey" AND o."ownerId"=NEW."ownerId" AND o."sourceSha256"=NEW."sourceSha256"
   AND o."configSha256"=NEW."configSha256" AND o.status='QUEUED' AND o."deletedAt" IS NULL)
 THEN RAISE EXCEPTION 'PDF provider grant ownership is invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfProviderGrant" BEFORE INSERT OR UPDATE ON "PdfProviderGrant" FOR EACH ROW EXECUTE FUNCTION "guardPdfProviderGrant"();

CREATE FUNCTION "guardPdfProviderCall"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt_key text;
BEGIN
 IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-'state'-'dispatchAttemptId'-'dispatchedAt'-'actualNano'-'providerGenerationId'-'receiptSha256'-'failureCode'-'settledAt')
   IS DISTINCT FROM (to_jsonb(OLD)-'state'-'dispatchAttemptId'-'dispatchedAt'-'actualNano'-'providerGenerationId'-'receiptSha256'-'failureCode'-'settledAt')
   OR (OLD.state IN ('SETTLED','RELEASED') AND NEW IS DISTINCT FROM OLD)
   OR (OLD."dispatchAttemptId" IS NOT NULL AND (NEW."dispatchAttemptId",NEW."dispatchedAt") IS DISTINCT FROM (OLD."dispatchAttemptId",OLD."dispatchedAt")))
 THEN RAISE EXCEPTION 'PDF provider call identity is immutable'; END IF;
 IF TG_OP='UPDATE' AND NEW.state<>OLD.state AND NOT
   ((OLD.state='RESERVED' AND NEW.state IN ('DISPATCHING','RELEASED')) OR (OLD.state='DISPATCHING' AND NEW.state IN ('UNCERTAIN','SETTLED')) OR (OLD.state='UNCERTAIN' AND NEW.state='SETTLED'))
 THEN RAISE EXCEPTION 'PDF provider call transition is invalid'; END IF;
 IF TG_OP='INSERT' OR (NEW.state='DISPATCHING' AND OLD.state='RESERVED') THEN
   attempt_key=CASE WHEN TG_OP='INSERT' THEN NEW."reservedAttemptId" ELSE NEW."dispatchAttemptId" END;
   IF NOT EXISTS (SELECT 1 FROM "PdfProviderGrant" g JOIN "PdfProviderRoute" r ON r.id=g."routeId"
     JOIN "PdfImportOperation" o ON o.id=g."operationId" JOIN "PdfConversionJob" j ON j."operationId"=o.id
     JOIN "PdfJobAttempt" a ON a.id=attempt_key JOIN "PdfWorkerPrincipal" p ON p.id=a."principalId"
     WHERE g.id=NEW."grantId" AND g.state='ACTIVE' AND r.state='ACTIVE' AND r."validUntil">clock_timestamp()
       AND j."dispatchAuthorizationId"=g.id AND j."currentAttemptId"=a.id AND a."jobId"=j.id
       AND j.state='RUNNING' AND o.status='RUNNING' AND o."deletedAt" IS NULL AND a.status='RUNNING'
       AND a."leaseExpiresAt">clock_timestamp() AND a."deadlineAt">clock_timestamp() AND p."revokedAt" IS NULL AND r."verifiedAt"<=clock_timestamp()
       AND a.fence=j."attemptFence" AND (a."jobInput"->>'generation')::integer=o.generation
       AND (a."jobInput"->>'cancellation_epoch')::integer=o."cancellationEpoch")
   THEN RAISE EXCEPTION 'PDF provider dispatch authority is invalid'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfProviderCall" BEFORE INSERT OR UPDATE ON "PdfProviderCall" FOR EACH ROW EXECUTE FUNCTION "guardPdfProviderCall"();

CREATE FUNCTION "guardPdfProviderPayload"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'PDF provider payload is immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "PdfProviderCall" c JOIN "PdfProviderGrant" g ON g.id=c."grantId"
   JOIN "StoredBlob" b ON b.id=NEW."blobId" WHERE c.id=NEW."callId" AND g."ownerId"=NEW."ownerId"
   AND b.checksum=NEW.checksum AND b."sizeBytes"=NEW."sizeBytes" AND octet_length(b.bytes)=NEW."sizeBytes"
   AND (NEW.kind<>'REQUEST' OR c."requestSha256"=NEW.checksum))
 THEN RAISE EXCEPTION 'PDF provider payload ownership or bytes are invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfProviderPayload" BEFORE INSERT OR UPDATE ON "PdfProviderPayload" FOR EACH ROW EXECUTE FUNCTION "guardPdfProviderPayload"();
CREATE FUNCTION "guardPdfProviderBlob"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "PdfProviderPayload" WHERE "blobId"=OLD.id) AND NEW IS DISTINCT FROM OLD
 THEN RAISE EXCEPTION 'Pinned PDF provider bytes are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfProviderBlob" BEFORE UPDATE ON "StoredBlob" FOR EACH ROW EXECUTE FUNCTION "guardPdfProviderBlob"();

ALTER TABLE "PdfProviderAllocation" ADD CONSTRAINT "pdf_provider_allocation_bounds" CHECK ("reservedNano">=0 AND "actualNano">=0);
ALTER TABLE "PdfProviderBudget" ADD CONSTRAINT "pdf_provider_model_ceiling" CHECK (scope<>'MODEL' OR "hardCeilingNano"<=10000000000);
CREATE FUNCTION "guardPdfProviderAllocation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND ((NEW.id,NEW."callId",NEW."budgetId") IS DISTINCT FROM (OLD.id,OLD."callId",OLD."budgetId")
  OR NEW."reservedNano">OLD."reservedNano" OR NEW."actualNano"<OLD."actualNano")
 THEN RAISE EXCEPTION 'PDF provider allocation identity is immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "PdfProviderCall" c JOIN "PdfProviderGrant" g ON g.id=c."grantId"
  WHERE c.id=NEW."callId" AND NEW."budgetId"=ANY(g."budgetIds"))
 THEN RAISE EXCEPTION 'PDF provider allocation scope is invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "immutablePdfProviderAllocation" BEFORE INSERT OR UPDATE ON "PdfProviderAllocation" FOR EACH ROW EXECUTE FUNCTION "guardPdfProviderAllocation"();
CREATE FUNCTION "checkPdfProviderCallTotals"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key text; call "PdfProviderCall"%ROWTYPE; n integer;
BEGIN
 IF TG_TABLE_NAME='PdfProviderCall' THEN key=NEW.id; ELSE key=NEW."callId"; END IF;
 SELECT * INTO call FROM "PdfProviderCall" WHERE id=key;
 SELECT count(*) INTO n FROM "PdfProviderAllocation" WHERE "callId"=key;
 IF n<>4 OR EXISTS (SELECT 1 FROM "PdfProviderAllocation" a WHERE a."callId"=key AND
  (a."reservedNano"<>CASE WHEN call.state IN ('RESERVED','DISPATCHING','UNCERTAIN') THEN call."reservedNano" ELSE 0 END
   OR a."actualNano"<>COALESCE(call."actualNano",0)))
 THEN RAISE EXCEPTION 'PDF provider call allocations are incomplete'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "pdfProviderCallTotals" AFTER INSERT OR UPDATE ON "PdfProviderCall"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "checkPdfProviderCallTotals"();
CREATE CONSTRAINT TRIGGER "pdfProviderCallAllocationTotals" AFTER INSERT OR UPDATE ON "PdfProviderAllocation"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "checkPdfProviderCallTotals"();
CREATE FUNCTION "guardPdfProviderGrantBudgets"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE route "PdfProviderRoute"%ROWTYPE; n integer;
BEGIN
 SELECT * INTO route FROM "PdfProviderRoute" WHERE id=NEW."routeId";
 SELECT count(*) INTO n FROM "PdfProviderBudget" b WHERE b.id=ANY(NEW."budgetIds") AND
  ((b.scope='GLOBAL' AND b."scopeKey"='ava') OR (b.scope='ACCOUNT' AND b."scopeKey"=route."accountKey")
   OR (b.scope='MODEL' AND b."scopeKey"=route."modelId") OR (b.scope='OPERATION' AND b."scopeKey"=NEW."operationKey"));
 IF cardinality(NEW."budgetIds")<>4 OR n<>4 OR NEW.state NOT IN ('ACTIVE','REVOKED')
 THEN RAISE EXCEPTION 'PDF provider grant budget scopes are invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "scopedPdfProviderGrant" BEFORE INSERT OR UPDATE ON "PdfProviderGrant" FOR EACH ROW EXECUTE FUNCTION "guardPdfProviderGrantBudgets"();
CREATE FUNCTION "guardPdfJobProviderGrant"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW."dispatchAuthorizationId" IS DISTINCT FROM OLD."dispatchAuthorizationId"
  AND (OLD."dispatchAuthorizationId" IS NOT NULL OR OLD."attemptCount"<>0 OR OLD.state<>'QUEUED')
 THEN RAISE EXCEPTION 'PDF job provider grant is immutable after claim'; END IF;
 IF NEW."dispatchAuthorizationId" IS NOT NULL AND NOT EXISTS
  (SELECT 1 FROM "PdfProviderGrant" g JOIN "PdfProviderRoute" r ON r.id=g."routeId"
   WHERE g.id=NEW."dispatchAuthorizationId" AND g."operationId"=NEW."operationId" AND r.mode=NEW."providerMode")
 THEN RAISE EXCEPTION 'PDF job provider grant scope is invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "scopedPdfJobProviderGrant" BEFORE INSERT OR UPDATE ON "PdfConversionJob" FOR EACH ROW EXECUTE FUNCTION "guardPdfJobProviderGrant"();
CREATE FUNCTION "retainOwnedPdfProviderPayload"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "User" WHERE id=OLD."ownerId") THEN RAISE EXCEPTION 'Live PDF provider checkpoint cannot be deleted'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER "retainOwnedPdfProviderPayload" BEFORE DELETE ON "PdfProviderPayload" FOR EACH ROW EXECUTE FUNCTION "retainOwnedPdfProviderPayload"();
