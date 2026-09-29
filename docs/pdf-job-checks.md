# Durable PDF jobs — operator checks

PDF-06 is an opt-in native worker boundary, not a finished conversion/reader release. See
[ADR10](adr/10-durable-pdf-jobs.md), [behavior](specs/3-library/3.6-pdf-jobs.md) and
[container setup and faults](pdf-runtime-checks.md). Keep paid dispatch disabled until PDF-07.

## Prerequisites and commands

Use a disposable database for fault testing; never point these commands at personal/production data.
Apply the new additive migrations with `pnpm --filter api db:migrate:deploy`, generate the client
with `pnpm --filter api db:generate`, then `pnpm --filter api build`. Existing EPUB data remains on
its current route. The migration backfills one native job for each live accepted QUEUED import.

Provide explicit `DATABASE_URL`, configured isolated runtime and the installed semantic-validator
interpreter. The operator scripts do not load dotenv files. Obtain `AVA_PDF_WORKER_TOKEN` through
private environment injection; use a random credential and never place its value in shell history,
logs, fixtures or documents. Registration prints only its principal ID.

```sh
pnpm --filter api pdf:jobs:admin register NAME IMAGE_SHA256_HEX
pnpm --filter api pdf:jobs:admin metrics
pnpm --filter api pdf:jobs:admin revoke PRINCIPAL_ID
pnpm --filter api pdf:jobs:admin stop OPERATION_ID
```

`stop` and `revoke` are administrative authority changes, not reader cancellation/retry. They cannot
reopen terminal Failed or replace finished content. Use the runtime runbook's worker once/serve
commands. A claim pins the registered implementation fingerprint; recovery must use that image.

## Fixed engineering bounds

Default policy: three attempts, 30-second leases, 30-minute total active execution, two simultaneous
jobs globally and one per owner/principal, 100 global and 10 owner queued/running jobs. Policy is
frozen at enqueue. Native recovery restarts from immutable source; PDF-08 owns page checkpoints.
Two intake slots per API process precede multipart buffering; excess uploads receive
`PDF_INTAKE_BUSY` before durable acceptance. Database backlog refusal returns `PDF_QUEUE_FULL`.

Candidate bytes receive private one-hour STAGING pins before the short authority transaction.
Fresh authority promotes exact descriptors to OPERATION retention; abandoned staging is collectible.
Review waiting releases execution resources and keeps owned candidates pinned. Candidate EPUBs are
not available through the original-file download route. PDF-12 owns the complete retention policy.

Status exposes safe stage/progress/failure identity; aggregate metrics expose backlog, leases,
recovery and resource/deadline failures. No provider payload, document text or credential is logged.
Failure notification intent is durable and deduplicated; actual delivery belongs to PDF-10/15.

## Verification boundary

Independent race, restart, stop/delete/revocation, quota, artifact and migration evidence is recorded
in the PDF-06 execution report and `output/pdf-epub-integration-06/` in the handbook workspace.
A fixed native candidate demonstrates the operational boundary, not source fidelity or reader
qualification. Full PDF-E/PDF-R app/device journeys and paid-provider receipts remain separate.
