-- Book deletion purges private prompts/pages/responses while preserving accounting.
CREATE OR REPLACE FUNCTION "retainOwnedPdfProviderPayload"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "User" WHERE id=OLD."ownerId") AND EXISTS (
  SELECT 1 FROM "PdfProviderCall" c JOIN "PdfProviderGrant" g ON g.id=c."grantId"
  JOIN "PdfImportOperation" o ON o.id=g."operationId"
  WHERE c.id=OLD."callId" AND o."deletedAt" IS NULL)
 THEN RAISE EXCEPTION 'Live PDF provider checkpoint cannot be deleted'; END IF;
 RETURN OLD;
END $$;
