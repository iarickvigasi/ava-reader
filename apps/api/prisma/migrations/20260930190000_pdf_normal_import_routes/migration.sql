-- Existing native/stub/replay jobs are unchanged. Live jobs require an exact grant.
ALTER TABLE "PdfConversionJob" DROP CONSTRAINT "pdf_job_bounds";
ALTER TABLE "PdfConversionJob" ADD CONSTRAINT "pdf_job_bounds" CHECK (
  "attemptFence" >= 0 AND "attemptCount" >= 0 AND "attemptCount" <= 3
  AND "providerMode" IN ('native', 'stub', 'replay', 'live')
  AND ("providerMode" <> 'live' OR "dispatchAuthorizationId" IS NOT NULL)
);

-- Normal import routes pin the registered worker and admission profile before claim.
-- Authored pilot grants keep their separate, preinventoried authorization path.
CREATE FUNCTION "guardPdfNormalImportRouteJob"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy jsonb; operation "PdfImportOperation"%ROWTYPE;
BEGIN
  IF NEW."providerMode" <> 'live' THEN RETURN NEW; END IF;
  SELECT r.configuration->'importPolicy' INTO policy
  FROM "PdfProviderGrant" g JOIN "PdfProviderRoute" r ON r.id=g."routeId"
  WHERE g.id=NEW."dispatchAuthorizationId";
  IF policy IS NOT NULL THEN
    SELECT * INTO operation FROM "PdfImportOperation" WHERE id=NEW."operationId";
    IF NEW."workerFingerprint" IS DISTINCT FROM policy->>'workerFingerprint'
       OR operation."profileId" IS DISTINCT FROM policy->>'profileId'
       OR operation."configSha256" IS DISTINCT FROM policy->>'configSha256'
    THEN RAISE EXCEPTION 'PDF normal import route identity is invalid'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "scopedPdfNormalImportRouteJob" BEFORE INSERT OR UPDATE ON "PdfConversionJob"
FOR EACH ROW EXECUTE FUNCTION "guardPdfNormalImportRouteJob"();
