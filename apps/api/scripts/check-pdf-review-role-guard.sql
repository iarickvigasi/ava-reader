\set ON_ERROR_STOP on
-- Execute the migrated PostgreSQL trigger against disposable, minimal fixtures.
-- Temporary tables shadow public tables only in this connection and roll back.
-- This covers database authority/immutability, not complete publication or OCR.
BEGIN;
CREATE TEMP TABLE "UserRoleMembership" ("userId" text, role text);
CREATE TEMP TABLE "PdfImportOperation" (id text, status text, "deletedAt" timestamp);
CREATE TEMP TABLE "PdfCandidateValidation" (
 id text, "operationId" text, "hardBlocks" text[], "reviewFindings" text[]
);
CREATE TEMP TABLE "PdfReviewDecision" (
 id text, "validationId" text, "reviewerKey" text, decision text, "approvedFindings" text[]
);
CREATE TRIGGER "testPdfReview" BEFORE INSERT OR UPDATE OR DELETE ON "PdfReviewDecision"
 FOR EACH ROW EXECUTE FUNCTION public."guardPdfReview"();
INSERT INTO "PdfImportOperation" VALUES ('op','WAITING',NULL);
INSERT INTO "PdfCandidateValidation" VALUES ('v','op','{}','{NEEDS_REVIEW}');
INSERT INTO "UserRoleMembership" VALUES ('admin','ADMIN'),('developer','DEVELOPER');
CREATE FUNCTION pg_temp.must_refuse(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE='P0001' AND SQLERRM=expected THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Expected refusal did not occur: %',expected;
END $$;
-- A different database error (including the original missing role column) cannot pass.
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('ordinary','v','ordinary','APPROVE','{NEEDS_REVIEW}')$$,
 'PDF review authority invalid');
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('developer','v','developer','APPROVE','{NEEDS_REVIEW}')$$,
 'PDF review authority invalid');
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('missing','v','admin','APPROVE','{}')$$,
 'PDF review authority invalid');
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('extra','v','admin','APPROVE','{NEEDS_REVIEW,OTHER}')$$,
 'PDF review authority invalid');
INSERT INTO "PdfReviewDecision" VALUES ('approved','v','admin','APPROVE','{NEEDS_REVIEW}');
SELECT pg_temp.must_refuse(
 $$UPDATE "PdfReviewDecision" SET decision='REJECT' WHERE id='approved'$$,
 'PDF review is immutable');
SELECT pg_temp.must_refuse(
 $$DELETE FROM "PdfReviewDecision" WHERE id='approved'$$,'PDF review is retained');
DELETE FROM "UserRoleMembership" WHERE "userId"='admin';
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('revoked','v','admin','APPROVE','{NEEDS_REVIEW}')$$,
 'PDF review authority invalid');
INSERT INTO "UserRoleMembership" VALUES ('admin','ADMIN');
UPDATE "PdfCandidateValidation" SET "hardBlocks"='{BLOCKED}';
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('blocked','v','admin','APPROVE','{NEEDS_REVIEW}')$$,
 'PDF review authority invalid');
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('blocked-reject','v','admin','REJECT','{}')$$,
 'PDF review authority invalid');
UPDATE "PdfCandidateValidation" SET "hardBlocks"='{}';
UPDATE "PdfImportOperation" SET status='FAILED';
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('failed','v','admin','APPROVE','{NEEDS_REVIEW}')$$,
 'PDF review authority invalid');
UPDATE "PdfImportOperation" SET status='WAITING',"deletedAt"=CURRENT_TIMESTAMP;
SELECT pg_temp.must_refuse(
 $$INSERT INTO "PdfReviewDecision" VALUES ('deleted','v','admin','APPROVE','{NEEDS_REVIEW}')$$,
 'PDF review authority invalid');
UPDATE "PdfImportOperation" SET "deletedAt"=NULL;
INSERT INTO "PdfReviewDecision" VALUES ('rejected','v','admin','REJECT','{}');
DELETE FROM "PdfCandidateValidation" WHERE id='v';
DELETE FROM "PdfReviewDecision";
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM "PdfReviewDecision") THEN RAISE EXCEPTION 'Review cleanup failed'; END IF;
END $$;
ROLLBACK;
\echo PASS: current ADMIN membership, ordinary/developer/revoked denial, findings, hard blocks, waiting/deletion and immutability
