# PDF conversion operations

[Behavior and pipeline](pdf-conversion.md) · [Checks and release gates](pdf-conversion-verification.md).
The API owns database/provider authority; the separately launched worker owns bounded execution.
Ordinary uploads do not enable paid OCR. The PRODUCT reader qualification catalog is currently empty.

## Build and configure

Use Node 22+, the repository's pinned pnpm, Docker, PostgreSQL and the worker's locked Python
3.12.14 environment. Install/build instructions and dependency/license inventory are in the
[worker README](../packages/pdf-epub/README.md). Select an explicit disposable database for tests.
Never apply fault tests or local pilot identities to production data.

```sh
pnpm install --frozen-lockfile
pnpm --filter api db:migrate:deploy
pnpm --filter api db:generate
pnpm --filter api build
docker build -t ava-pdf-epub:local packages/pdf-epub
docker image inspect ava-pdf-epub:local --format '{{.Id}}'
```

Provide `DATABASE_URL` privately. Operator scripts do not automatically load dotenv files.
Configure these trusted environment values; reader input must never supply paths, image or credentials:

| Variable | Value/purpose |
|---|---|
| `AVA_PDF_RUNTIME_ENABLED` | `1` to enable configured isolated execution |
| `AVA_PDF_DOCKER_BINARY` | Absolute Docker executable path |
| `AVA_PDF_DOCKER_HOST` | Absolute local Unix Docker socket URI |
| `AVA_PDF_WORKER_IMAGE` | Exact `sha256:` image ID, not a mutable tag |
| `AVA_PDF_CONTRACT_PYTHON` | Absolute trusted installed-worker Python interpreter |
| `AVA_PDF_WORKER_TOKEN` | Privately injected random worker credential; never put in argv/logs |
| `AVA_PDF_WORKER_PRINCIPAL` | Registered principal ID returned by registration |
| `AVA_PDF_READER_QUALIFICATION_ID` | Valid registered reader/adapter build qualification; test IDs cannot authorize production |

```sh
pnpm --filter api pdf:jobs:admin register NAME IMAGE_SHA256_HEX
pnpm --filter api pdf:jobs:admin metrics
pnpm --filter api pdf:worker once
pnpm --filter api pdf:worker serve
pnpm --filter api pdf:jobs:admin stop OPERATION_ID
pnpm --filter api pdf:jobs:admin revoke PRINCIPAL_ID
```

The API does not launch this operator. `once` runs one reconstruction tick and one candidate scan;
`serve` repeats serially. SIGTERM/SIGINT stop active work. Stop/revoke are administrative authority
changes, not reader cancellation or permission to reopen Failed. Recovery keeps the registered
image/source/configuration identity. Canonical EPUB processing uses the same sandbox; configuration
is checked before consuming an attempt. Disabled runtime does not block unrelated legacy EPUB work.

## Isolation, limits and artifacts

Defaults: network disabled, read-only root, nonroot UID 10001, dropped capabilities, one CPU,
512 MiB/no swap and 32 processes. Allowed CPU is 0.25–2 and memory 128 MiB–2 GiB; noexec scratch
is bounded to 2 GiB and counts toward memory. Containers receive source/frozen input/read-only
lease control, never provider credentials or a writable host output mount.

Source limit is 50 MiB/500 pages; inspection 30s. Reconstruction stream bounds: 512 MiB aggregate,
canonical 20 MiB, EPUB 256 MiB, report 4 MiB, resources 200 MiB, 1,003 entries and encoded stdout
704 MiB. Hash-check every retained descriptor. Image edges/pixels/object counts are bounded;
not every inline/pattern raster is enumerated, so sandbox/render bounds still matter. These are
refusal ceilings, not demonstrated book/phone capacity.

Default frozen job policy: three attempts, 30s leases, 30 minutes total active execution,
two simultaneous jobs globally/one per owner and principal, 100 global/10 owner queued-running.
Two intake slots per API process precede multipart buffering. Candidate staging uses private
one-hour pins; accepted/review references must remain retained. Human review waiting releases
execution resources. Fresh publication checks cannot revive an expired worker lease.

A monotonic supervisor observes fresh DB-derived lease duration and kills work on expiry; no host
clock agreement is assumed. GNU timeout bounds total execution. Normal exit removes container/input;
startup reaps only marked same-UID private runtime directories after deadline plus two minutes.
An inactive operator host still needs a deployment janitor. Production private-file cleanup remains
disabled with no scheduler; do not equate download revocation with physical erasure.

## Provider accounting

From `apps/api`, use `pnpm exec ts-node src/scripts/pdf-provider-admin.ts` with a command below.
No administration command itself sends a provider request. Supply credentials privately.

| Command | Purpose |
|---|---|
| `metrics` | Aggregate budget/reservation states; not a transactional snapshot |
| `register-budget JSON` | Create/exactly verify immutable cap plus historical known/unknown baseline |
| `register-route JSON` | Pin permitted model/provider, endpoint/privacy evidence, source/tasks, schema and tariff |
| `settle CALL_ID RECEIPT_JSON` | Attach an authoritative provider receipt; never invent billing |
| `release-undispatched CALL_ID` | Only if no dispatch intent committed |
| `reactivate-reconciled ROUTE_ID` | Only after every unknown receipt is accounted for |
| `resume-reconciled OPERATION_ID` | Reconciled nonterminal wait; never Failed |
| `revoke-route ROUTE_ID` | Permanently deny future dispatch |

Strict route/tariff types are in `apps/api/src/library/pdf-import/providers`. Rates use USD per
million tokens plus explicit request/image fees; reserves include maximum context/output/images.
Pin verified endpoint evidence and expiry (at most 24h); live diagnostic grants additionally bind
finite owner/operation/source/image/task/render/request inventories. A prior pilot window is not
a fresh tariff or deployment route. Unknown/dispatching charges stay reserved across timeout,
restart and account deletion until reconciled; there is no blind resend, assumed refund or cap reset.
The benchmark's cumulative $10 per exact model is an operator testing constraint, not reader pricing.

## Migrations, rollback and diagnostics

Apply committed additive migrations in order; never edit applied migrations. Fresh-database
verification must include existing EPUB data, sessions, canonical markers and artifact ownership.
Before deployment, verify backup/restore and gates. Once canonical records exist, prefer code
rollback with additive schema and private cover/pin protections retained. Disable new admission;
do not automatically drop tables, erase sources or run older incompatible GC/label maintenance.
Actual rollback and production activation still require qualification.

Only development canaries may set `AVA_PDF_RUNTIME_FAULT=deadline|memory|scratch|output|cpu`
with `AVA_PDF_FAULT_ACK=AVA_PDF_RUNTIME_FAULTS_V1`; production rejects them and reconstruction
refuses fault mode before claim. Test-only provider pilots are separate from ordinary upload.
Retain operation/fence/source/configuration, safe stage/error code and actual/reserved/unknown cost;
never log book text, model payloads or credentials. Do not reset Failed to repair environment setup.
