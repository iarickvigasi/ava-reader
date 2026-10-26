# Catalog metadata import operations

CLI: apps/catalog/src/importer/main.ts. Use approved [bulk channels](https://openlibrary.org/developers/dumps); no network requests.
Retain immutable originals externally. Parsed JSON, SHA-256, revisions, diagnostics, and outcomes
live in catalog PostgreSQL. Contract: [Open Library importer](specs/12-explore-catalog/12.6-open-library-import.md).

## Run locally

1. Configure apps/catalog/.env as in [catalog setup](catalog.md), then run
   `pnpm --filter catalog db:generate` and `pnpm --filter catalog db:migrate:deploy`.
2. Import authors, works, then editions:
   `pnpm --filter catalog import:open-library --file /absolute/path/authors.txt.gz`.
3. Repeat after interruption to resume committed progress. Retry staged missing references with
   `pnpm --filter catalog import:open-library --retry`.
4. Run `pnpm --filter catalog test:importer` against a disposable catalog DB only. It covers bulk
   relationships, mixed groups, placeholders, rollback/fallback, replay, guards, and timeout recovery.

## Separate container worker

- Apply migrations first (`pnpm catalog:up` runs them); the worker never migrates the database.
- Put acquired files in ignored imports/ or point CATALOG_IMPORT_DIRECTORY at an existing directory.
  Run `pnpm catalog:import --file /imports/authors.txt.gz`, then works and editions;
  `pnpm catalog:import --retry` retries relationships after dependencies arrive.
- The profile-only worker mounts inputs read-only, has no API port, and exits when finished.
  Local limits are 0.5 CPU/512 MiB; production uses 1 GiB, a 768 MiB heap, and attached-volume files.
- One catalog-wide session advisory lock refuses concurrent importers; it uses a dedicated connection.
  Transactions group up to 25 records. New authors/works/editions bulk-write metadata and relationships;
  mapped entries keep revision guards, repeated keys stay ordered, and mixed groups bulk-write new rows.
  Missing/ambiguous edition works retain placeholder/unresolved handling. Manual revisions stay protected.
- SQL allows 60s per statement; transactions allow 120s. Reads and canonical transactions retry
  cancellation, deadlock, and serialization failures three times total with 1s/2s backoff. Failed groups
  roll back before individual fallback. Unclassified individual failures exit 1, preserving progress.
- Logs identify the actual sequential record or bulk operation/group boundaries. `importBatch` includes
  readMs, applyMs, transactionMs, recordWriteMs, transactions, fallbackRecords, bulkRecords, recordsPerSecond.
  Page time includes retry delays; transaction/write times exclude backoff but include failed attempts.
- Optional worker-image check: `pnpm --filter catalog test:importer:docker` (local Compose only).

## Failed records and review

- ImportRecord retains runId, line, externalId, revision, payload, status, and a diagnostic (up to 500 chars).
  INVALID and CONFLICT remain for manual review; they are excluded from automatic apply retries.
- UNRESOLVED is retried after dependencies arrive. Some records are already published with missing
  author credits; others (such as ambiguous work links) remain unpublished. Inspect the diagnostic.
- Operational errors roll back the current transaction and leave its records pending/unresolved.
  Malformed TSV/JSON and oversized lines retain only run/line/diagnostic, not raw contents; keep originals.
- Review is SQL-based; there is no review UI or automatic overwrite switch. Filter by runId/kind/status.
  The final summary reports current-run counts for --file, all staged-run counts for --retry. Remaining
  INVALID/CONFLICT cause exit 2 after valid records finish. ImportRun.error covers staging failures.

## Storage and maintenance

Staging commits up to 100 rows/4 MiB plus checkpoint (larger valid rows alone). Apply reads 50 records
through `ImportRecord_runId_kind_status_id_idx`; full JSON follows ID selection. Its concurrent index
migration needs temporary disk headroom; interrupted invalid indexes require removal/migration resolution.
Gzip resume rescans the prefix; SHA-256 adds a file pass. The line ceiling is 8 MiB. CatalogOutbox retains
entity/revision changes; the search consumer, full-corpus benchmarks, COPY, and retention remain pending.
Measure disk and contention before full dumps. Deploy updated images, stop the old worker, then create
an updated worker with --retry; restarting the old container does not upgrade its image.
For retained-data enrichment use `pnpm --filter catalog exec ts-node scripts/enrich-open-library.ts`
with CATALOG_DATABASE_URL after its migration/client deployment. See [category maintenance](catalog-categories.md).
