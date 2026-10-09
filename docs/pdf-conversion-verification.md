# PDF conversion verification

[Product/pipeline](pdf-conversion.md) · [Operator setup](pdf-conversion-operations.md).
The implementation remains a draft candidate. Package conformance, source fidelity, reader behavior
and operational/release qualification are separate verdicts.

## Reproduce automated checks

Use an explicit test database/environment; Prisma generation needs a configured URL, while contract
checks do not dispatch models. Run from the repository root:

```sh
pnpm --filter api pdf:contracts:check
AVA_PDF_CONTRACT_PYTHON=/absolute/installed-worker/bin/python pnpm --filter api pdf:reconstruction:check
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api lint
pnpm --filter web lint
pnpm --filter api exec jest --runInBand
pnpm --filter web exec vitest run --maxWorkers=2
pnpm --filter api build
cd packages/pdf-epub
uv sync --locked --extra dev --python 3.12.14
uv run python -m unittest discover -s tests -v
uv run ruff check src tests scripts
uv run mypy src/ava_pdf_epub
```

Regenerate schema/types deliberately with `pdf:contracts:generate` and
`pdf:reconstruction:generate`, then rerun their checks. The absolute semantic bridge interpreter
runs isolated validation, with bounded input/time/output and no forwarded provider credentials.
Use the worker README for installed-wheel/container smoke; exit 2 is a candidate, not Ready.

## API readiness regression

The focused suite uses a controlled Prisma provider with the actual Nest/Express HTTP adapter. It
checks healthy HTTP 200, dependency-failed HTTP 503, safe uncached payloads and public reachability
without consulting the database. It also executes the actual Compose API health command against
healthy, degraded, unknown, malformed and HTTP/request-failed responses, with no external requests.

```sh
pnpm --filter api exec jest --runInBand --runTestsByPath src/app.service.spec.ts src/app.controller.spec.ts src/app.health.spec.ts src/app.health-probe.spec.ts
```

These tests do not stop a database, boot the full API or qualify the built container, real PostgreSQL
outage/recovery, PDF worker/validator/provider prerequisites or overall production readiness. Record
those operating gates independently before activation; a healthy API/database response cannot close
them. The full app e2e health check requires an available test database and asserts only the healthy
HTTP 200 contract.

## Reporting persistence and operator verification

For worker observations, preserve the original command stdout/exit when clocks, inventory,
observation-file writes or report storage fail. Exercise the real packet separator with a full
ordinary-stderr allowance, split chunks and duplicates; check job/source/auxiliary-request,
command/page and fence mismatches. Verify unchanged resource/fault precedence and bounded queue
loss during terminal/lease transitions. Source-level tests do not establish installed transport,
durable loss completeness, actual process overhead or complete conversion/reader quality.

Run the packaged OCR cases in the installed worker: a host suite that skips cases requiring
`/usr/bin/tesseract` leaves those cases unqualified. Record process/native-hint/end-scratch scopes
and unknown values accurately; do not convert them into container-peak or whole-book quality claims.

Run types/lint before the disposable reporting proof. Its runtime command uses transpilation without
repeating typechecking. Configure `DATABASE_URL` privately and select only the dedicated loopback
PostgreSQL database `ava_pdf_reports_test` on port 55417, with applied reviewed migrations. Set
`AVA_PDF_REPORTS_PROOF=synthetic-only`; the command verifies the actual database/schema and refuses
existing non-synthetic users before writing fixtures.

```sh
pnpm --filter api typecheck
pnpm --filter api pdf:reports:proof run
pnpm --filter api pdf:reports:proof verify-restart CONVERSION_ID
```

The proof creates guarded synthetic owned imports and provider authority, never runs PDF parsing,
Clerk sign-in, the worker or a provider request. It tests concurrent same-key admission/refusal/retry,
ordered deduplicated journals/conflict refusal/fixed cursors, report-sink failure inside PostgreSQL
savepoints with authoritative receipts preserved, all four allocations, exact 1,001-call aggregation
and all 11 bounded detail pages, fresh ADMIN revocation, retained cost after operation/timeline purge
and blocked deleted-import replay. Run the emitted retained reference in a separate process for the
restart check. Run only one proof at a time in this database. Synthetic fixtures deliberately
remain for review/restart checks. Fault triggers are confined to the disposable database and removed
in normal finally cleanup; an abrupt process kill does not guarantee that cleanup. Inspect or
recreate only this disposable database before another run after such an interruption.

Repeat the relevant real-app flows separately: normal operator authentication, refused admission,
conversion failure/uncertain billing, validation/publication refusal, restart/late worker, lookup,
pagination/export and denied ordinary-account access. Synthetic role fixtures do not qualify those
journeys. Source/package checks, installed-worker execution, full required books and release/restore
remain separate. Keep the original fixture CHECK, identifier-contract, lint and timing failures with
all repaired/retest evidence. Never weaken database guards or raise test deadlines to obtain a pass.

On constrained development hosts, schedule heavy package checks sequentially. Record hardware and
competing-process conditions; a host swap snapshot cannot establish an AVA leak or production limit.
A targeted timeout retest does not erase a failed full run; qualify the full candidate at unchanged
deadlines under the stated conditions.

## Generated EPUB boundary regressions

The worker tests cover exact independently authored text/order, chapter/section and cross-file
note/return targets, figure bytes/captions/geometry, tables/lists, literal whitespace, Unicode
normalization maps and explicit false/zero styles. Real native single/two-column fixtures now cross
the reconstruction → visible EPUB → portable reimport → reader-package boundary. Printed-label tests
cover Roman numerals, restarted numbers, XML characters and missing/blank labels, a frozen pre-change
2.1 projection, marker substitution and unknown-version refusal. Blank labels previously caused
EPUBCheck RSC-005; exact corrected bytes must also pass the installed validator.

API metadata regressions preserve accepted portable title/author claims without changing provenance
or overriding new-entry edits/clears. PDF source-only metadata filling retains its own regression.
These checks do not establish source accuracy, actual reader/device behavior or production readiness.
Use the normal walkthrough below and keep each verdict separately bound to exact artifacts/builds.

## Adapter and reimport checkpoint — 4 October 2026

The current installed worker's native and two-column outputs pass independently authored
source/structure/resource oracles, EPUBCheck and whole-canonical portable reimport. Normal signed-in
Library EPUB uploads preserve those exact outputs and reach Read. The ordinary EPUB control keeps
27 authored passages, original illustration bytes, nested Contents, notes/backlinks, finite styles
and literal whitespace. A missing required illustration fails normal preparation with its exact
source location, no readable output and unchanged prior accepted books.

Two observed blank Notes paths are repaired: cold resume and paging from the preceding heading.
The active view uses the chapter geometry actually measured for that chapter. Stored content and
accepted identities remain fixed. Retain both original failures and the insufficient cold-only repair.
Offset regressions cover trimmed whitespace, empty/wrapper/list/image anchors and styled Unicode;
legacy flat-list identity remains unchanged. Ordinary mixed-list flow and structured table cells
outside the selected profile produce source-linked refusals rather than flattened success.

The original six adapter acceptance criteria and four scope checks have independent phase-2 review.
Fresh root tests pass 1,283 API and 1,499 web tests without cache; installed worker tests pass 531.
Types, lint, API/web builds and generated contracts pass, with two inherited web lint warnings.
Package conformance, accepted-source conservation and observed desktop reader behavior have separate
verdicts. TEST prerequisites, installed-image overlays and generated EPUB uploads do not establish
production qualification, a clean image rebuild, live OCR or a full PDF upload-to-reading journey.
Full supplied-book, scan/mixed, offline/account, lifecycle and device/assistive checks remain open.
Private source files, runtime receipts and screenshots stay outside repository assets.

## Normal-app walkthrough

Use authored/authorized fixtures with independent source text/order/style/link/image expectations,
normal sign-in and a disposable database. Record exact app/reader/image/schema/profile/route IDs,
source and artifact hashes, device/network condition, timestamps and failed attempts. TEST
qualification is isolated test evidence; it cannot grant product readiness.

1. Import an English native one-column and two-column PDF with Convert to EPUB selected.
   Check one durable Library entry, truthful Processing, Original PDF available and EPUB/Read withheld.
2. Leave/reload/return; confirm the same operation and correct status. After Ready, check title,
   author/language without forced reload, notification deduplication and the correct Read destination.
3. Compare every passage and structure to the source: reading order, omissions/duplicates,
   chapter XHTML/spine/TOC, emphasis/spacing, figures/captions, tables/lists/verse/code and metadata
   provenance. Verify exact local/shared/cold note links and Return/Back origins, including A→B→C.
4. Save marks across emphasis, emoji/combining text and structured passages; change font/theme/width,
   reload and reopen exact ranges. Check fixed book/chapter identity, progress and translations.
5. Download original PDF and accepted EPUB from Library and reader; verify bytes. For an ordinary
   EPUB, offer its original EPUB only. Test duplicate clicks, close/account/book changes during a
   request, unavailable API with visible error/retry, offline unavailability and keyboard focus after
   desktop/phone reflow. Candidate/internal formats and archived/foreign membership must be refused.
   Open the EPUB in an independent reader
   and reimport it normally into AVA. Check structures/styles/links/images separately from EPUBCheck.
6. Repeat scan/mixed/broken-OCR/rotation fixtures with real permitted recognition and source oracles.
   Record native versus provider routing, known/uncertain cost and per-stage time; no invented text.
7. Exercise unchecked import, duplicate/replay/conflict, malformed/encrypted/limits, terminal Failed,
   ADMIN review/hard blocks, interruption/restart/late completion, cross-account and deletion races.
   Failed must remain Failed with safe investigation reference/notification and original download.
8. Verify complete/interrupted offline downloads and genuine disconnection/reconnect, account changes,
   translations and required assets. Use physical phones and assistive/keyboard conditions before
   claiming support. API-loss and desktop viewport emulation alone are insufficient.
9. Freeze the final candidate; execute capacity/quality/spending targets, migration/restore/rollback,
   review required findings and record release/deployed smoke evidence separately.

## Recorded evidence and remaining gates

29 September snapshots passed 260 worker tests, Ruff/strict mypy, 1,361 web tests and a 995-test
merged API baseline. Later scoped suites cover provider/refinement, metadata, publication and
details-cache repairs; counts overlap and must not be added as unique journeys. All 39 migrations
passed on fresh PostgreSQL 16. These results apply to recorded snapshots, not future changes.

Normal signed-in local native imports reached Ready/Read under TEST qualification. Scoped desktop
and 390px emulation covered nested Contents, local/shared/cold notes, Return/Back, figures/captions,
downloads and generated EPUB reimport. Exact ordinary/Unicode-prefix/table-cell marks and enlarged
type reopening passed. API-loss queued a highlight and synchronized it exactly once; a five-second
API read deadline repaired cached-book reload. Authored French bilingual source-note/Return/reload
passed pairing/navigation, not live translation or word alignment. A fresh native run updated
English/title/author and formats without reload; admission-to-publication was 99.001s with zero
provider calls on one local run, not a general performance benchmark.

Retained repaired failures include ID/slug navigation, shadowed notification route, missing reimport
runtime setup, publication report-schema drift, stale full-details cache and hidden duplicate
canonical DOM IDs. Tests preserve the original failed boundary; Failed/accepted bytes were not replaced.

A two-call Gemini Flash book-refinement experiment took about 118s/$0.0862434. It used authored
page observations, not live page OCR. Independent review passed 135 text/structure assertions:
16 blocks/1,235 characters, eight heading relationships, two chapter XHTML files, nested TOC and
scoped emphasis/size. EPUBCheck/roundtrip passed, but body line-height varies 1.35 versus inherited
1.5 across batches against uniform source 17/11. Typography is partial; the candidate is unpublished.
Earlier live page recognition lost authority with unresolved billing; exposure stays held.

Next: source-backed shared spacing across batches, full live scanned/mixed reconstruction, remaining
Back/structured/offline/account/translation/download/deletion/error flows, final frozen qualification
and actual phone/assistive evidence. PRODUCT qualification is empty; cleanup remains disabled.
No merge/deployment or valid EPUB file is itself a release, whole-book fidelity or capacity PASS.
Private books, payloads, credentials, account data and local evidence are not repository assets.

### Reader whitespace qualification

Canonical text can contain intentional newlines even in ordinary paragraphs and headings.
The shared text-inline renderer preserves whitespace across styled runs; this matches the
EPUB text-leaf behavior without inserting characters or changing source offsets. Qualification
must inspect browser line geometry as well as serialized text: a text-equality assertion alone
missed a real paired-line rendering failure. The supplied Ukrainian book passed normal import
and EPUBCheck5.4.0 in the isolated local environment; its reader-only fix passes1380web tests
and typecheck, with two retained lint warnings. Exact source indentation, subsection semantics,
metadata completeness, owned round trip, device/continuity coverage and independent review
remain separate gates. A regenerated reader fingerprint requires a matching consumer
qualification; a TEST-only record enables local QA and never authorizes production.

Measured canonical heading size must be compared with the reader's prose baseline; it must not be multiplied by a second semantic heading enlargement. Native inline size remains relative to its containing line. Scoped correction is covered by source/unknown/ordinary EPUB regression cases and actual desktop/390px viewport measurements; full web1383tests and typecheck pass, lint retains two warnings. Source identity cb5ad0af…f019c9 is TEST-only and does not replace immutable publication bytes or establish independent review. At125% text, large title words still break within words; retain this readability finding and complete source metadata, style/TOC, device and whole-book qualification before release.

### Whole-book search and production identity

The integrated candidate searches complete fixed canonical text without provider calls. Ordinary
EPUB Search requires the authoritative ordered chapter manifest and one content revision across
all windows; incomplete, mixed or unverified legacy caches report unavailable, while their cached
reading remains available. Legacy online qualification/refresh and general target-navigation
revision fencing remain open gates. Literal Unicode matching retains
source offsets; results identify chapter/excerpt, and exact result navigation uses the existing Back
session. Verify distant occurrences beyond the active chapter, larger text, result limits, no-match
and unavailable states, keyboard dismissal, cached content, account isolation and physical phones.
Verify complete downloaded Search after a cold offline load where the auth SDK is unavailable.
The mounted reconciled device owner authorizes local access; network token/ownership checks remain
unchanged. Repeat sign-out, account/DB transition and revision changes during pending corpus work.
Open Search at desktop width, resize to phone width while it remains open, then dismiss with Escape
and reopen with Enter. Repeat in the other direction; focus must return to the visible Search
control. Leaving the book must not move focus back into an unrelated reader control.

Scoped signed-in desktop checks pass for legacy/canonical distant result and Back, measured135% text
and cached canonical reload with the API unavailable. These are separate from physical/production
offline, phone and assistive-use qualification. The post-build source-identity check caught generated
precache output contaminating the fingerprint; the explicit output exclusion, regression and actual
production rebuild now pass. No accepted publication was replaced and independent review remains
pending. Private source, screenshots and diagnostic records remain outside repository assets.

On 3 October, the updated candidate additionally passes a signed-in390×844 viewport check:
uppercase Ukrainian distant-chapter search, exact result heading, Back to the origin, completed
no-match feedback and the same navigation at130% text. Search initially lost keyboard focus after
desktop-to-phone resizing; a shared visible-control return repairs it and preserves Download focus
in both resize directions. The updated web source fingerprint is
`f515c9088eed6c32607c5dc30af9e3788f45198ebaa26765ef177b2692198545`;1453web tests, typecheck,
lint and production build pass, with the same two lint warnings. A sandbox refusal to write the
TypeScript incremental cache was resolved by checking without incremental output. Viewport checks
remain separate from physical phones, assistive use, full offline/account and corpus qualification.

### Reader download and text-size checkpoint

The isolated candidate connects the existing reader Download control on desktop and phone to
owned original/accepted files. Server tests cover ownership, archive/removal races, ambiguous or
damaged originals and accepted-publication delegation; client checks cover cancellation, account
changes and response format. Font steps preserve the default when reversing either limit.
The current source identity is `7b2a065ded49b794611d4eed56d7b5092dae0080820eb2e3f7049890b1af83df`.
On 3 October, 1181 API tests and 1448 web tests, type checks and both builds pass. Lint has no errors
and two retained warnings; existing test-helper timezone warnings are retained.

Signed-in app observations verify endpoint reversal on the immediately preceding source, ordinary
EPUB and converted PDF format choices, exact downloaded bytes, visible API-loss error and retry.
The final source additionally verifies a fresh exact EPUB download at 390×844, keyboard reopening
and focus return after desktop-to-phone reflow. This fixes the observed focus-loss defect; it is a
desktop viewport check, not physical-phone or assistive-use qualification. TEST registration changes
no accepted book/publication. Independent review, the remaining reader flows and frozen five-book
regression remain open; this checkpoint does not close PDF-04 or qualify production.
