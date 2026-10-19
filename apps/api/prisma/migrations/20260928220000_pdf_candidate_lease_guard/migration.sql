-- Result validation/staging runs outside metadata locks. Check the lease again at candidate receipt.
CREATE FUNCTION "guardPdfCandidateLease"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='CANDIDATE' AND OLD.status='RUNNING' AND
    (NEW."leaseExpiresAt"<=clock_timestamp() OR NEW."deadlineAt"<=clock_timestamp() OR NOT EXISTS (
      SELECT 1 FROM "PdfConversionJob" j JOIN "PdfImportOperation" o ON o.id=j."operationId"
      JOIN "PdfWorkerPrincipal" p ON p.id=NEW."principalId"
      WHERE j.id=NEW."jobId" AND j."currentAttemptId"=NEW.id AND j."attemptFence"=NEW.fence
        AND j.state='RUNNING' AND o.status='RUNNING' AND o."deletedAt" IS NULL AND p."revokedAt" IS NULL
        AND (NEW."jobInput"->>'generation')::int=o.generation
        AND (NEW."jobInput"->>'cancellation_epoch')::int=o."cancellationEpoch"))
  THEN RAISE EXCEPTION 'PDF candidate lease expired or revoked'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "livePdfCandidateReceipt" BEFORE UPDATE ON "PdfJobAttempt"
FOR EACH ROW EXECUTE FUNCTION "guardPdfCandidateLease"();
