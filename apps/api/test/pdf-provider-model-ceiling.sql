-- psql -f in a disposable predecessor-migrated database or schema; all test changes roll back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_schema() !~ '^ava_pdf_budget_ceiling_[a-z0-9_]+$'
    AND current_database() !~ '^ava_pdf_budget_ceiling_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Disposable budget-ceiling test database or schema required';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='"PdfProviderBudget"'::regclass
    AND conname='pdf_provider_model_ceiling') THEN
    RAISE EXCEPTION 'Predecessor model ceiling required';
  END IF;
END $$;
CREATE FUNCTION pg_temp.expect_budget_refusal(command text, expected_state text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE=expected_state THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected budget refusal %', expected_state;
END $$;
INSERT INTO "PdfProviderBudget" (id,scope,"scopeKey","limitNano","hardCeilingNano",
  "actualNano","baselineNano","baselineEvidenceSha256","updatedAt")
VALUES ('old-model','MODEL','other-model',10000000000,10000000000,
  9000000000,9000000000,repeat('e',64),now());
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
CREATE TEMP TABLE before_budget AS SELECT to_jsonb(b) AS row FROM "PdfProviderBudget" b;
CREATE TEMP TABLE before_constraints AS
  SELECT conname,conrelid,pg_get_constraintdef(oid) AS definition FROM pg_constraint
  WHERE connamespace=current_schema()::regnamespace;
CREATE TEMP TABLE before_triggers AS
  SELECT tgname,tgrelid,pg_get_triggerdef(oid) AS definition FROM pg_trigger
  WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace=current_schema()::regnamespace);
SELECT pg_temp.expect_budget_refusal($q$INSERT INTO "PdfProviderBudget"
  (id,scope,"scopeKey","limitNano","hardCeilingNano","baselineEvidenceSha256","updatedAt")
  VALUES ('blocked-model','MODEL','google/gemini-3.8-flash',15000000000,15000000000,
    repeat('e',64),now())$q$, '23514');
\ir ../prisma/migrations/20261015010000_pdf_operator_model_ceiling/migration.sql
DO $$ BEGIN
  IF EXISTS (SELECT * FROM before_budget EXCEPT SELECT to_jsonb(b) FROM "PdfProviderBudget" b)
    OR EXISTS (SELECT to_jsonb(b) FROM "PdfProviderBudget" b EXCEPT SELECT * FROM before_budget)
  THEN RAISE EXCEPTION 'Existing budget changed'; END IF;
  IF EXISTS (SELECT * FROM before_constraints WHERE conname<>'pdf_provider_model_ceiling'
    EXCEPT SELECT conname,conrelid,pg_get_constraintdef(oid) FROM pg_constraint
    WHERE connamespace=current_schema()::regnamespace AND conname<>'pdf_provider_model_ceiling')
    OR EXISTS (SELECT conname,conrelid,pg_get_constraintdef(oid) FROM pg_constraint
      WHERE connamespace=current_schema()::regnamespace AND conname<>'pdf_provider_model_ceiling'
      EXCEPT SELECT * FROM before_constraints WHERE conname<>'pdf_provider_model_ceiling')
  THEN RAISE EXCEPTION 'Other constraints changed'; END IF;
  IF EXISTS (SELECT * FROM before_triggers EXCEPT SELECT tgname,tgrelid,pg_get_triggerdef(oid)
    FROM pg_trigger WHERE tgrelid IN
      (SELECT oid FROM pg_class WHERE relnamespace=current_schema()::regnamespace))
    OR EXISTS (SELECT tgname,tgrelid,pg_get_triggerdef(oid) FROM pg_trigger
      WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace=current_schema()::regnamespace)
      EXCEPT SELECT * FROM before_triggers)
  THEN RAISE EXCEPTION 'Accounting triggers changed'; END IF;
END $$;
INSERT INTO "PdfProviderBudget" (id,scope,"scopeKey","limitNano","hardCeilingNano",
  "actualNano","baselineNano","baselineEvidenceSha256","updatedAt")
VALUES ('new-model','MODEL','google/gemini-3.8-flash',15000000000,15000000000,
  9000000000,9000000000,repeat('e',64),now());
SET CONSTRAINTS ALL IMMEDIATE;
UPDATE "PdfProviderBudget" SET "limitNano"=14601866100 WHERE id='new-model';
SET CONSTRAINTS ALL DEFERRED;
SELECT pg_temp.expect_budget_refusal($q$INSERT INTO "PdfProviderBudget"
  (id,scope,"scopeKey","limitNano","hardCeilingNano","baselineEvidenceSha256","updatedAt")
  VALUES ('over-model','MODEL','google/gemini-3.8-flash',15000000001,15000000001,
    repeat('e',64),now())$q$, '23514');
SELECT pg_temp.expect_budget_refusal($q$INSERT INTO "PdfProviderBudget"
  (id,scope,"scopeKey","limitNano","hardCeilingNano","baselineEvidenceSha256","updatedAt")
  VALUES ('other-model','MODEL','another-model',10000000001,10000000001,
    repeat('e',64),now())$q$, '23514');
SELECT pg_temp.expect_budget_refusal($q$INSERT INTO "PdfProviderBudget"
  (id,scope,"scopeKey","limitNano","hardCeilingNano","baselineEvidenceSha256","updatedAt")
  VALUES ('alias-model','MODEL','google/gemini-3.8-flash:free',10000000001,10000000001,
    repeat('e',64),now())$q$, '23514');
SELECT pg_temp.expect_budget_refusal($q$INSERT INTO "PdfProviderBudget"
  (id,scope,"scopeKey","limitNano","hardCeilingNano","baselineEvidenceSha256","updatedAt")
  VALUES ('case-model','MODEL','GOOGLE/GEMINI-3.8-FLASH',10000000001,10000000001,
    repeat('e',64),now())$q$, '23514');
SELECT pg_temp.expect_budget_refusal($q$INSERT INTO "PdfProviderBudget"
  (id,scope,"scopeKey","limitNano","hardCeilingNano","baselineEvidenceSha256","updatedAt")
  VALUES ('over-limit','MODEL','new-key',1,0,repeat('e',64),now())$q$, '23514');
SELECT pg_temp.expect_budget_refusal($q$UPDATE "PdfProviderBudget"
  SET "reservedNano"=-1 WHERE id='new-model'$q$, '23514');
SELECT pg_temp.expect_budget_refusal($q$UPDATE "PdfProviderBudget"
  SET "hardCeilingNano"=15000000000 WHERE id='old-model'$q$, 'P0001');
SELECT pg_temp.expect_budget_refusal($q$UPDATE "PdfProviderBudget"
  SET "limitNano"=15000000000 WHERE id='new-model'$q$, 'P0001');
SELECT pg_temp.expect_budget_refusal($q$UPDATE "PdfProviderBudget"
  SET "baselineNano"=8000000000 WHERE id='new-model'$q$, 'P0001');
SELECT pg_temp.expect_budget_refusal($q$UPDATE "PdfProviderBudget"
  SET "baselineEvidenceSha256"=repeat('f',64) WHERE id='new-model'$q$, 'P0001');
SELECT pg_temp.expect_budget_refusal($q$DELETE FROM "PdfProviderBudget"
  WHERE id='new-model'$q$, 'P0001');
CREATE FUNCTION pg_temp.invalid_budget_totals() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  UPDATE "PdfProviderBudget" SET "reservedNano"=1 WHERE id='new-model';
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;
SELECT pg_temp.expect_budget_refusal('SELECT pg_temp.invalid_budget_totals()', 'P0001');
SET CONSTRAINTS ALL IMMEDIATE;
SELECT 'PASS_EXACT_FLASH15_DEFAULT10_ROWS_BOUNDS_IMMUTABILITY_RETENTION_DEFERRED_TOTALS' AS result;
ROLLBACK;
