-- Role memberships replaced User.role. Keep the database review authority guard
-- aligned without changing historical migrations or weakening immutable reviews.
CREATE OR REPLACE FUNCTION "guardPdfReview"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'PDF review is immutable'; END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM "PdfCandidateValidation" WHERE id=OLD."validationId") THEN RAISE EXCEPTION 'PDF review is retained'; END IF;
  RETURN OLD;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "UserRoleMembership" WHERE "userId"=NEW."reviewerKey" AND role='ADMIN')
  OR NOT EXISTS(SELECT 1 FROM "PdfCandidateValidation" v JOIN "PdfImportOperation" o ON o.id=v."operationId"
    WHERE v.id=NEW."validationId" AND o.status='WAITING' AND o."deletedAt" IS NULL AND cardinality(v."hardBlocks")=0
    AND (NEW.decision='REJECT' OR (NEW."approvedFindings" @> v."reviewFindings" AND NEW."approvedFindings" <@ v."reviewFindings")))
 THEN RAISE EXCEPTION 'PDF review authority invalid'; END IF;
 RETURN NEW;
END $$;
