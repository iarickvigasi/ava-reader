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
5. Download original PDF and accepted EPUB; verify bytes. Open the EPUB in an independent reader
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
