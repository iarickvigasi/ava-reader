# AVA PDF → EPUB worker

A separate Python package for source-linked book reconstruction and deterministic EPUB 3 assembly.
It does not import NestJS, alter AVA's database, replace a reader revision, or publish a library item.
The [integration decision](../../docs/adr/7-pdf-worker-contracts.md) defines the versioned boundary;
[worker verification](../../docs/pdf-worker-checks.md) records scoped integration checks.
This package implements standalone tooling and the integrated reconstruction/assembly layer.
The host API now connects upload, durable jobs, validation/publication and typed reader delivery;
those responsibilities remain outside this Python package.

The integrated route uses `reconstruction_v2` to preserve source order, structured content and
measured styles in `ava-book-2`, then emits a generated EPUB profile and reader-v3-compatible graph.
The host coordinates page/region tasks, provider reservations and review. Native, scan and mixed
routing exists, but ordinary imports do not automatically activate live OCR/provider dispatch.
The [book-level refinement phase](../../docs/pdf-refinement-checks.md) preserves original page
observations and accepts only source-bound structure/style/join decisions, never replacement prose.
[Runtime checks](../../docs/pdf-runtime-checks.md) and
[publication checks](../../docs/pdf-publication-checks.md) describe the executable boundary.

Actual signed-in desktop native imports, owned downloads and ordinary generated-EPUB reimport
passed in the local task environment using TEST qualifications. The PRODUCT reader catalog remains
empty. This evidence does not establish OCR quality, all supported books, physical phones,
accessibility, offline/account journeys or production readiness.

**Status: 0.1.0 implementation candidate.** Packaging and worker checks are separate from source
accuracy, print-style fidelity, accessibility and actual reader behavior. A produced file is a
reviewable EPUB, not a declaration that the whole product is production-ready.

## Install and run

The commands below are the **legacy standalone diagnostic interface** (`ava-book-1`). They remain
useful for benchmarks, reviewed reconstruction and canaries; their exit/result is not the integrated
canonical-v2 route or permission to publish. Use the host runtime above for Library processing.

Python **3.12.14**, uv **0.9.26**, Poppler (`pdftoppm`) for reference rendering/crops, and Java for
optional EPUBCheck. The Python 3.12 compatibility line is declared in `pyproject.toml`;
`.python-version` pins the verified patch release. `uv.lock` records all runtime/development
transitive versions and archive hashes. The build backend is pinned separately in `pyproject.toml`.
Use an isolated environment and `--locked`; dependency drift then fails instead of rewriting the lock.
See [native build inputs](native-dependencies.json), the full optional
[EPUBCheck distribution hash manifest](epubcheck-distribution.json), and
[dependency/license inventory](THIRD_PARTY.md).

```sh
uv sync --locked --extra dev --python 3.12.14
.venv/bin/ava-pdf-epub inspect /input/book.pdf
.venv/bin/ava-pdf-epub convert /input/book.pdf \
  --work-dir /private/jobs --owner reader-123 --request-key import-123 \
  --epubcheck-jar /tools/epubcheck.jar
```

Reuse source-bound benchmark OCR without spending on recognition again:

```sh
.venv/bin/ava-pdf-epub from-benchmark /input/book.pdf \
  --run /input/ocr-run --work-dir /private/jobs \
  --owner reader-123 --request-key replay-123 \
  --epubcheck-jar /tools/epubcheck.jar
```

The adapter requires `book-plan-finalized.json`, `config.json`, and every `pages/NNNN.json`, with
matching source/config/page hashes. It never reads benchmark gold as extraction evidence.

Build from a reviewed interchange record, without PDF extraction or an LLM:

```sh
.venv/bin/ava-pdf-epub schema book > book.schema.json
.venv/bin/ava-pdf-epub schema review > review.schema.json
.venv/bin/ava-pdf-epub build /input/book.json --assets /input/assets \
  --review /input/review.json --work-dir /private/jobs \
  --owner reader-123 --request-key initial-reviewed-import
```

Commands print JSON. Exit `0` is a completed diagnostic/schema/status command, `1` is a failure,
and `2` means an EPUB was produced with review/readiness obligations. `build`, `convert` and
`from-benchmark` deliberately do not report product readiness. Their result contains `epub_path`,
SHA-256, job ID, measured runtime, detailed issues, assembly checks and independent EPUBCheck status.
The current three conversion commands perform **zero paid calls**; optional recognition is a
separately configured Python adapter, never an automatic fallback.

```sh
.venv/bin/ava-pdf-epub status JOB_ID --work-dir /private/jobs --owner reader-123
.venv/bin/ava-pdf-epub cancel JOB_ID --work-dir /private/jobs --owner reader-123
```

## Public contract

```python
from pathlib import Path
from ava_pdf_epub.pipeline import run_conversion

result = run_conversion(
    source=Path("/input/book.json"), mode="book", asset_root=Path("/input/assets"),
    work_dir=Path("/private/jobs"), owner="reader-123", request_key="import-123",
    epubcheck_jar=Path("/tools/epubcheck.jar"),
)
```

`models.Book` (`ava-book-1`) is the legacy standalone interchange. The integrated canonical graph
is `contracts.book.CanonicalBookV2` (`ava-book-2`), with separate reader/result schemas. Unknown fields are rejected. Every page
is accounted for, block IDs are unique, chapter boundaries refer to actual blocks, source evidence
is preserved, and inline ranges use Unicode code points with an optional canonical-text SHA-256.
`Evidence.coordinate_space` distinguishes point coordinates from normalized image crops.
`Style.observed` distinguishes a measured zero/false from an unspecified editorial default.

`review.Review` is an explicit editorial patch bound to both PDF SHA-256 and canonical serialized
Book SHA-256. It can set chapter boundaries, accepted metadata, source styles, inline spans and
assets. Each span/style edit also names its expected text hash. It cannot silently rewrite prose
or remove historical issues. Review artifacts stay private with the job.

Other public functions:

- `extract.inspect_pdf(path)` — structural inventory; the CLI isolates it with a timeout.
- `extract.extract_native(path, asset_root)` — conservative native geometry/text/style candidates.
- `benchmark.import_benchmark(pdf, run, asset_root)` — verified replay and conservative reconstruction.
- `epub.build_epub(book, asset_root, output)` — deterministic, network-free assembly and structural checks.
- `state.JobStore` / `state.BudgetStore` — resumable artifact jobs and cumulative cost authorization.

## Optional recognition

For the standalone interface, `recognition.OpenRouterProvider` and `recognition.recognize_page`
form an explicit page-level recognition boundary. The integrated route uses the API's separate
funded provider ledger; it never places the provider key inside this container. The caller supplies an API key, exact model and provider route, output limit,
timeout, a current tariff quote ID and a conservative maximum charge for that request. The module
does not search environment files, choose a paid model or infer an allowance from available credit.

Initialize `BudgetStore.configure(model, cap_microusd=10_000_000, ...)` with actual historical
spend **and** unresolved-charge exposure; do not reset prior benchmark usage to zero. Calls reserve
before dispatch. The provider uses image bytes, typed JSON output, a fixed endpoint, no redirects,
no tools and no routing fallback. Prompt and response data cannot supply executable instructions.
Malformed output still counts as billed. A raw response is durably stored before cost settlement;
a restart after an uncertain dispatch requires explicit reconciliation rather than another charge.

The returned `Page` contains canonical text, typed styles/ranges, normalized source regions and
review issues. Incorporate it into a validated candidate `Book` and rerun reconstruction before the initial
export. Figure/table/math candidates retain source-region placeholders and explicit unsupported
findings; they are not silently promoted into invented prose or images. Recognition is not wired
as an unattended whole-book fallback in this release. Its transport is verified with fake provider
responses and failures; no live OpenRouter quality/cost claim is made by those tests.

## What assembly does

- Splits at actual block boundaries into separate chapter XHTML; supports preceding front matter,
  nested navigation, spine order, landmarks and source page navigation.
- Allocates all addresses before writing links; resolves cross-file notes and multiple return links.
  Missing/unsafe references remain issues. Source text is retained, never changed to hide a link error.
- Builds finite shared CSS rules plus source-aligned emphasis. Paragraph indentation, first paragraphs,
  chapter headings, quotations, verse, notes, images and captions have reflowable editorial styles.
  Exact page geometry and exact fonts are not claimed.
- Uses original source pixels for image crops; checks asset hashes, containment, media types,
  dimensions and decompression limits. Bytes can be deduplicated without losing figure occurrences.
- Writes accepted metadata with source-edition provenance and a generated EPUB identity. A print ISBN
  does not become the generated EPUB's unique identifier. No publication date is invented.
- Reopens generated XML resources and checks references, required files, source text conservation
  and block coverage. EPUBCheck is independent and optional; omission is `not_run`.

## Operational guarantees and limits

The coordinator snapshots inputs, fingerprints implementation/dependencies/configuration, and stores
checkpoints as immutable, verified artifacts. An owner/request key is bound to source and config:
changing either requires a new request. A succeeded request reuses its existing result without new
extraction. Standalone execution failures can resume from the Book checkpoint, with at most three failed
execution attempts. This local recovery mechanism is not the integrated terminal `Failed` state.
AVA must reject a replay of a terminal failed import under its shared contract; the standalone
CLI does not authorize reader-facing retry, later conversion or replacement of finished content.

SQLite `BEGIN IMMEDIATE` serializes leases and reservations across processes on **one local disk**.
Lease fences and cancellation epochs prevent late workers from completing a replacement/cancelled
job. Attempt-private assets prevent stale overwrites. Corrupted artifacts fail verification rather
than being silently reused. Cancellation is cooperative; subprocess work is terminated when the
coordinator observes lost ownership. Cancellation does not reverse a completed result or paid call.

Cost accounts use integer microUSD and exact model IDs. There is no implicit allowance. Initialize
with all historical spend and conservative unknown-charge exposure, then atomically reserve a
credible maximum charge before dispatch. An existing reservation never authorizes another call.
Timeout/unknown billing retains its full reservation until explicit reconciliation. A provider
exceeding a bound records the real charge and halts that model. Client-side accounting cannot force
a provider to honor a quoted bound; a provider/account-side cap is also needed for a hard billing cap.
The benchmark's $10 per model restriction is separate from internal processing budgets. AVA funds
product processing; this module does not introduce reader prices or credits.

The library assumes a trusted calling service and a private workspace. `owner` scopes job lookup;
it is not authentication. Do not expose the CLI or arbitrary file paths directly to browser input.
Run PDF parsers in an OS/container sandbox with CPU, memory, disk, page-count and wall-time limits.
The subprocess applies memory/CPU limits on Linux; macOS requires external resource isolation.
This is not a hostile multi-tenant service boundary. SQLite on NFS/distributed replicas is unsupported.

## Deliberate unsupported/review paths

- Annotation-bearing, encrypted or unqualified concealed/clipped/rotated native content requires safe
  source handling. Refusal does not mean the PDF is corrupt. No hidden text is deliberately exposed.
- Scans need an explicitly configured recognizer or reviewed/replayed extraction. Native extraction
  preserves measured line candidates and flags paragraph order/structure for review.
- Synthetic OCR fonts do not establish original font weight, family or italics.
- Cross-page ambiguous hyphens, unmatched headings, note references and uncertain blank pages remain
  visible issues. Repeated numbers are resolved by source occurrence, not global label matching.
- Complex tables/math, general vector-semantic reconstruction, fixed-layout output, embedded licensed
  fonts and full source-region recall certification remain outside the qualified scope. The integrated
  graph and native reconstruction preserve finite measured styles, supported tables and list markers;
  this is not automatic recovery of every print style or every source region.
- The replay adapter's first-page preview is labeled as such; it is not a discovered original cover.
- AVA upload/library publication, audio/offline readiness, device-reader behavior
  and full accessibility qualification are outside this package's verified scope.

## Verification

```sh
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check src tests scripts
.venv/bin/mypy src/ava_pdf_epub
```

Tests include text preservation, styles, chapters/TOC/notes, traversal/unsafe links, malformed inputs,
real SQLite connection races, cancellation, stale leases, restart, corrupted checkpoints, budget
reservations/unknown charges, and conservative source handling. The task's actual supplied-book
measurements and review findings live in the
[worker verification guide](../../docs/pdf-worker-checks.md). Historical standalone evidence does
not certify the integration branch or a deployed import flow.

## Package and container smoke

Run the package commands from this directory. The smoke output directory must not already exist;
this prevents old results being mistaken for a new run. The small two-page source is original test
prose with a native image, generated locally by `scripts/smoke.py` without any provider.

```sh
make check
make build
make smoke OUT=output/native-smoke EPUBCHECK_JAR=/tools/epubcheck-5.4.0/epubcheck.jar
make inventory OUT=output/inventory
```

`make build` explicitly selects `PYTHON` and fixes `SOURCE_DATE_EPOCH`; use `PYTHON=/path/to/python`
when the virtual environment is elsewhere. It produces a wheel and source distribution. The smoke
executes the installed `ava-pdf-epub` entry point with provider/proxy credentials removed from its
subprocess environment. It checks inspection, native extraction and crop assembly, exit 2, retained
result JSON, EPUB checksum/text/image presence, same-key reuse and job status. With a configured
EPUBCheck distribution, independent conformance must pass too. Runtime result paths and JSON logs
are retained under `OUT`; exit 2 remains a candidate requiring review, never Ready/publication.
The smoke also writes `contract-job.json`, `contract-binding.json` and `contract-result.json`.
It obtains invocation identity from its private SQLite state, hashes the original source, and uses
the trusted legacy-result adapter to check the real saved result, Book, EPUB and asset bytes.
The adapter preserves `ava-book-1` as a legacy candidate; it does not claim v2 migration or publish it.

The Dockerfile pins multi-platform Python and uv manifest digests, the Debian repository snapshot,
and direct native package versions. Runtime and dev dependencies come from the same lock; the
container installs only runtime dependencies and a non-editable wheel. The snapshot also fixes the
available transitive native package versions. This pins dependency selection, not byte-identical
OCI layers. Update snapshots/digests deliberately and rerun checks for maintenance updates.

```sh
make container
mkdir -p output
# Mount the complete EPUBCheck release including its lib/ directory.
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 1 \
  --tmpfs /tmp:rw,nosuid,nodev,size=128m \
  --mount type=bind,src="$(pwd)/scripts",dst=/scripts,readonly \
  --mount type=bind,src="$(pwd)/output",dst=/evidence \
  --mount type=bind,src=/tools/epubcheck-5.4.0,dst=/epubcheck,readonly \
  --entrypoint /worker/.venv/bin/python ava-pdf-epub:pdf02 \
  /scripts/smoke.py --out /evidence/container-smoke --epubcheck-jar /epubcheck/epubcheck.jar
```

The image runs as UID/GID 10001; a Linux host must provision its dedicated output directory for that
user. Only the output mount is writable. Networking is unnecessary for native/replay assembly.
These smoke limits exercise a tiny source; they are not production book-capacity sizing. The image
contains no provider keys, source books, caches or test evidence. It includes the pinned, hash-checked
EPUBCheck distribution used by integrated validation; standalone smoke may also supply an explicit
complete distribution as shown above.
Its installed native package inventory is `/usr/share/ava/native-dependencies.tsv`; the Python
version/license inventory is `/usr/share/ava/python-dependencies.json`. Third-party license files
remain alongside their distributions and under `/usr/share/doc`.

`src/ava_pdf_epub/contracts/schemas/*.json` ships in the wheel. Contract schema identities are
versioned independently of package version `0.1.0`; the legacy standalone result remains
`ava-conversion-result-1` until an explicit integration adapter validates it into the shared result.

Canonical v2 has an isolated `epub_v2` export/reimport boundary, separate from the legacy extraction
CLI. It preserves structured content and source evidence in a declared generated EPUB profile.
[Content checks and limits](../../docs/pdf-content-checks.md) distinguish authored-fixture conservation
from PDF reconstruction, ordinary import, publication and renderer qualification.

The opt-in [durable runtime](../../docs/pdf-runtime-checks.md) wraps admission, reconstruction,
generated-EPUB reimport and EPUB validation in a pinned container with network denial, resource
quotas and a lease-expiry supervisor. Reconstruction streams hash-checked canonical/EPUB/resources
to the host as a candidate. Only separate source validation, required review and a qualified reader
permit the host to publish one immutable Ready book. Standalone legacy canaries remain candidates.
Host-side provider dispatch exists behind explicit route/source/budget authority; no live route is
enabled merely by starting the ordinary worker, and no model call occurs inside this container.
