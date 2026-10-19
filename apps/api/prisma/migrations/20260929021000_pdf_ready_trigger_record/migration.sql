-- Reproduced on disposable DB: trigger records have distinct field layouts.
CREATE OR REPLACE FUNCTION "assertPdfReadyPublication"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE opid text; o "PdfImportOperation"; p "PdfPublication";
BEGIN
 opid:=COALESCE(to_jsonb(NEW)->>'operationId',to_jsonb(NEW)->>'id');
 SELECT * INTO o FROM "PdfImportOperation" WHERE id=opid;
 IF o.id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO p FROM "PdfPublication" WHERE "operationId"=opid;
 IF (o.status='READY') IS DISTINCT FROM (p.id IS NOT NULL) OR
   (p.id IS NOT NULL AND o."finalContentId" IS DISTINCT FROM p."finalContentId")
 THEN RAISE EXCEPTION 'PDF Ready requires exactly one matching publication'; END IF;
 RETURN NULL;
END $$;
