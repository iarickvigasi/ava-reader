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

Update the host semantic validator alongside the worker image and generated API contracts.
An older installed Python package can reject a valid new EPUB as `INVALID_CONTRACT`, even
when the image and JSON schemas are current. Install a new isolated environment from the
same reviewed source and lockfile, then point both the API and processing service at it:

```sh
UV_PROJECT_ENVIRONMENT=/absolute/path/ava-pdf-contracts uv sync --python 3.12.14 --project packages/pdf-epub --locked --no-dev --no-editable --no-cache --reinstall-package ava-pdf-epub
/absolute/path/ava-pdf-contracts/bin/python -I -c 'from ava_pdf_epub.contracts.styles import Style; assert "block_indent_em" in Style.model_fields'
```

For merged-table tasks, also check that the installed `RecognitionTask` prompt literal includes
`ava-prose-region-4` and `RecognitionCell` includes `source_cell_id`. The package version alone
is insufficient: cached wheels can retain old code when the local version is unchanged.

The field check diagnoses this contract revision; it is not full deployment qualification.
Verify a representative generated EPUB through the actual importer and reader before activation.
Keep any failed import and its diagnostics; use a fresh test import after correcting deployment,
without modifying finished content or introducing a reader retry/reconversion action.

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
| `AVA_PDF_WORKER_MODES` | Admin registration only: comma-separated modes; default `native`; use `native,live` for a configured normal import worker |
| `AVA_PDF_IMPORT_PROFILE` | Server-only admission profile: absent uses `ava-pdf-prose-en-v2`; `ava-pdf-prose-en-uk-v3` opts into the English/Ukrainian candidate. Reader input cannot select profile. Activate only with matching worker/provider/reader qualification; v3 is not product-qualified yet |
| `AVA_PDF_PROVIDER_ROUTE_ID` | API import selection: registered active normal import route ID; absent defaults to native-only jobs |
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
2 GiB/no swap and 32 processes. Allowed CPU is 0.25–2 and memory 128 MiB–2 GiB; noexec scratch
is bounded to 2 GiB and counts toward memory. Containers receive source/frozen input/read-only
lease control, never provider credentials or a writable host output mount.

Source limit is 50 MiB/500 pages; inspection 30s. Reconstruction stream bounds: 512 MiB aggregate,
canonical/reader contracts and streamed artifacts 128 MiB, EPUB 256 MiB, report 4 MiB, resources 200 MiB, 1,003 entries and encoded stdout
704 MiB. Hash-check every retained descriptor. Image edges/pixels/object counts are bounded;
not every inline/pattern raster is enumerated, so sandbox/render bounds still matter. These are
refusal ceilings, not demonstrated book/phone capacity.

Generated EPUB import runs EPUBCheck before expanding canonical/reader models, so its Java heap
does not overlap those models. The fixed limits remain enforced at both Python and API boundaries;
large capacity does not waive EPUB conformance, provenance, semantic checks or reader qualification.

Default frozen job policy: three attempts, 30s leases, 120 minutes total active execution,
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

### HTTP failure investigation

New non-success HTTP receipts retain a bounded private body plus safe status/completeness,
classification, allowlisted machine limit source and bounded Retry-After seconds when supplied.
General provider events contain only that safe diagnostic, never raw provider text, IDs or headers.
Known HTTP failures receive an HTTP status failure code; historical unknown calls are not rewritten.
A retry hint is operator evidence, not authorization to send again.

These diagnostics do not settle charges, release reservations, resume jobs or replace finished
content. Complete HTTP errors without authoritative billing still remain uncertain. Keep their
private receipt/hash, pause the route and use existing reconciliation commands only with valid
provider evidence. Rate limits from an upstream shared pool are distinct from AVA limits and credits.
The [OpenRouter error contract](https://openrouter.ai/docs/api_reference/errors-and-debugging)
distinguishes HTTP rejection from failures inside a started response; a cause alone is not a receipt.

### Normal import route

A live route for ordinary uploads uses `configuration.importPolicy`: version `1`, exact
`workerFingerprint`, admission `profileId` and `configSha256`, and finite
`maxRequestsPerOperation` (1–2,000). Set `authorizedSourceSha256` to an empty array and omit
`pilotInventory`. Only this explicit policy accepts newly uploaded sources through owned import
admission; diagnostic pilots retain their exact preinventoried source/task restrictions.
Zero data retention and denied data collection are required. Refresh endpoint/privacy/tariff evidence
before registration; a synthetic test tariff must never authorize a real paid run.

Set `AVA_PDF_PROVIDER_ROUTE_ID` only after registering the route and cumulative GLOBAL, ACCOUNT
and exact MODEL budgets with their historical known/unknown exposure. Ordinary import creates its
OPERATION budget, grant and worker-pinned job in the same transaction as its owned book entry.
The live worker must be explicitly registered for `live`; registration does not authorize provider
requests by itself. Grants bind source/owner/profile, requests bind source and approved prompts/schemas,
and the existing ledger reserves before dispatch. Request limits count distinct reservations;
reusing an identical persisted request does not allocate twice. Finished or terminal imports cannot
acquire a new initial grant. Native text remains a zero-provider path within live-capable jobs.

Apply `20260930190000_pdf_normal_import_routes` before selecting this route. It permits granted
live jobs and enforces import worker/profile identity in PostgreSQL. Normal workers exclude authored
pilot jobs. Unset the route ID to stop selecting live routes for new uploads; revoke a route to deny
future dispatch on existing grants. Neither operation restores unknown exposure or replaces content.
Mechanics have real isolated PostgreSQL/admission-worker tests. A source-bound two-page scanned
Underline fixture completed normal signed-in live recognition and automatic Ready/Read, with matching
owned EPUB download and ordinary reimport. The temporary paid route was revoked after the run. This
is scoped TEST evidence with a retained first-line-indent mismatch, not production qualification.
Broader source/reader qualification, independent review and deployment/rollback remain open.

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

### Reader source identity and build output

Run `node apps/web/scripts/generate-reader-fingerprint.mjs` before freezing reader source and
registering its consumer qualification. Run the same command with `--check` after a production
build. The fingerprint binds application source, fonts, dependency lockfile and generator; it excludes
the generated precache asset list, whose chunk hashes would otherwise invalidate the build's own
source identity. A regression verifies that precache changes are ignored while source changes bind
a new identity. A stable fingerprint is not qualification or independent review.
