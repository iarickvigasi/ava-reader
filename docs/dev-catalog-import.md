# Catalog metadata import operations

CLI: apps/catalog/src/importer/main.ts. Import only files you acquired through the provider's
approved [bulk channels](https://openlibrary.org/developers/dumps); no network requests run here.
The original immutable files must be retained externally for retries/auditing. Imported raw JSON,
file SHA-256, source revision, timestamp, line diagnostics, and outcomes live in catalog PostgreSQL.

## Run locally

1. Configure apps/catalog/.env as in [catalog setup](dev-catalog.md), then run
   `pnpm --filter catalog db:generate` and `pnpm --filter catalog db:migrate:deploy`.
2. Import in order: authors, works, editions. Each command also retries staged missing references:
   `pnpm --filter catalog import:open-library --file /absolute/path/authors.txt.gz`.
3. Repeat that command after interruption; it resumes the committed checkpoint for the same bytes.
   Retry unresolved relationships without rereading a file:
   `pnpm --filter catalog import:open-library --retry`.
4. Integration checks on a disposable catalog DB: `pnpm --filter catalog test:importer`.
   They create/delete isolated fictional fixtures; do not run against production metadata.

## Separate container worker

- Apply migrations first (`pnpm catalog:up` runs them); the worker never migrates the database.
- Put acquired files in ignored imports/ or set CATALOG_IMPORT_DIRECTORY to an existing directory.
- Run `pnpm catalog:import --file /imports/authors.txt.gz`, then works and editions.
  `pnpm catalog:import --retry` resolves missing relationships after new files arrive.
- The profile-only catalog-importer container mounts inputs read-only, has no API port, and exits
  when finished. It is limited to 0.5 CPU/512 MiB; canonical transactions execute sequentially.
  Production overrides the worker to 1 GiB with a 768 MiB Node heap and attached-volume inputs.
  Staging uses a transaction-local 60s SQL timeout and a 120s transaction deadline;
  a failed batch rolls back with its checkpoint and can be resumed using the same input.
  PostgreSQL connections use the catalog pool plus one dedicated advisory-lock connection.
- Two concurrent importers are refused by a catalog-wide PostgreSQL advisory lock. Failed DB/file
  operations exit 1; malformed/conflicting records exit 2 after other valid records finish.
  Missing references are reported as UNRESOLVED, not silently guessed. Fix upstream data or import
  dependencies, then retry. INVALID/CONFLICT need review, not an automatic overwrite switch.

The optional `pnpm --filter catalog test:importer:docker` check uses a built worker image and the
local Compose catalog DB; it mounts temporary gzip fixtures and removes the test metadata afterward.

## Inspect and operate

The JSON summary contains runId, committed line checkpoint, and counts by status (current run for
--file; all staged Open Library records for --retry). Read ImportRun.error for staging failures.
Use read-only SQL against catalog PostgreSQL to inspect ImportRecord where runId matches the summary;
line, externalId, revision, status, and diagnostic identify problems without exposing raw data in logs.
CatalogOutbox holds durable entity/revision changes; its search/refresh consumer is still pending.

Staging batches up to 100 rows/4 MiB per transaction (a larger valid row is written alone); application reads 50 records at a time and commits each
canonical record separately. Memory is bounded, including 8 MiB oversized-line quarantine. Gzip
resume scans/decompresses the prefix; SHA-256 identification is an additional sequential file pass.
This baseline favors correctness over throughput: full Open Library corpus storage, COPY-based
loading, byte-offset checkpoints, raw archival/retention automation, and throughput benchmarks remain
pending. Do not start a full dump on the shared server without measuring disk space and contention.

## Enrich retained metadata

After deploying the enrichment migration/client, run
`pnpm --filter catalog exec ts-node scripts/enrich-open-library.ts` with `CATALOG_DATABASE_URL`.
This bounded, advisory-locked command replays importer-owned works/editions from retained JSON,
including covers, categories, and missing credits. It performs no provider downloads. Manual
canonical revisions remain protected; inspect reported conflicts. Incomplete source work records
use the edition title until the actual work arrives and retain the source work ID for reconciliation.
Category maintenance: [category rebuild operations](dev-catalog-categories.md).
