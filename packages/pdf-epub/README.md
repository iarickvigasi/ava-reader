# AVA PDF → EPUB worker

A separate Python package for source-linked book reconstruction and deterministic EPUB 3 assembly.
It does not import NestJS, alter AVA's database, replace a reader revision, or publish a library item.
The [integration decision](../../docs/pdf-conversion.md) defines the versioned boundary;
[worker verification](../../docs/pdf-conversion-verification.md) records scoped integration checks.
This package implements standalone tooling and the integrated reconstruction/assembly layer.
The host API now connects upload, durable jobs, validation/publication and typed reader delivery;
those responsibilities remain outside this Python package.

The integrated route uses `reconstruction_v2` to preserve source order, structured content and
measured styles in `ava-book-2`, then emits a generated EPUB profile and reader-v3-compatible graph.
The host coordinates page/region tasks, provider reservations and review. Native, scan and mixed
routing exists. Ordinary imports default to native-only execution; the host can select a registered
normal import route with `AVA_PDF_PROVIDER_ROUTE_ID`. The host then binds a grant to the owned
source/profile and pins the worker build. Native text needs no recognition call; ambiguous same-font
chapter/list roles may require bounded structure comparison. Qualified structure remains zero-call.
New imports may explicitly capture native source-ID structure decisions through server policy
`ava-native-structure-1` together with `ava-native-layout-1`. Distinct captured hashes select
private Input4/Prepare3 packets; old Layout1 captures retain Input3 unchanged.
The separate `ava-native-word-wrap-1` source normalization opt-in additionally requires both
policies and captures distinct Input5/Prepare4 configuration hashes. A finite catalogue after
accepted refinements sends only short verbatim contexts and opaque IDs for lexical decisions;
source assembly and exact normalization stay in the worker. Historical captures are unchanged. Providers return
only ordered source-line groups, eligible note-callout span IDs and pinned boundary dispositions.
Literal text, measured styles and spans remain worker-owned. This opt-in requires matching worker,
host admission and provider authorization; the selector does not activate itself.
Native-only execution refuses unresolved required comparisons. Route mechanics
have isolated database evidence. A scoped two-page scanned Underline fixture also completed normal
signed-in live recognition, automatic publication, Read and owned EPUB export/reimport. Broader book,
annotation and production qualification remains open. Source first-line and whole-block
indentation are represented separately; complete supplied-book/reader qualification is ongoing.
The [book-level refinement phase](../../docs/pdf-conversion.md) preserves original page
observations and accepts only source-bound structure/style/join decisions, never replacement prose.
The current host policy also requests finite source comparisons for OCR quotations and generic
block typography, with complete local reference crops. Unknown optional features remain recorded;
unresolved essential quotation roles refuse conversion. These comparisons preserve text, inline
ranges and chapter structure. Versioned task 4/response 4 and report 2 keep this authority separate
from historical refinement contracts; see the [finite comparison boundary](../../docs/pdf-conversion.md#finite-ocr-quotation-and-style-comparisons).
[Runtime checks](../../docs/pdf-conversion-operations.md) and
[publication checks](../../docs/pdf-conversion-verification.md) describe the executable boundary.

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

Historical books without an explicit source-page map use generated EPUB projection
`ava-epub-canonical-2.1` for unlabelled pages and `2.2` for declared printed page labels. New
reconstructions capture each page's first retained content observation before paragraph joins, then
resolve its exact canonical codepoint offset through checked assembly aliases. This makes a page
that begins midway through a joined paragraph open at that page's own first words.

The map uses optional `Address.source_page` (physical PDF page number, 1–500) with fragment
`ava-source-page-N`. It must cover every retained content page exactly once, in its owned chapter
and resource, with bounded offsets and first-region evidence. Blank or furniture-only pages have
no borrowed destination. A nontext start addresses its own table, illustration or separator at
zero. Missing, ambiguous or conflicting mappings refuse assembly. Unset `source_page` is omitted
from serialization; ordinary old identities, including names that resemble the page prefix, keep
their original meaning and hashes.

Explicit maps require reader capability `source-page-starts` and generated EPUB projection
`ava-epub-canonical-2.3`. That projection places zero-text page-break markers at the exact retained
text offset or beside the owned nontext block, and creates its page-list links from the same map.
Physical page IDs remain unique when printed labels restart. Printed labels supply link text,
with physical-number fallback for missing or blank labels. Styles and semantic links keep their
text and occurrence identity; a link spanning a page marker remains one focusable anchor. TOC and
specific passage links retain their separate exact destinations.

`epub_v2.portable.portable_epub` validates every supported projection against its declared
version. It refuses substitutions between explicit-map and legacy page semantics and does not
upgrade imported bytes. The old `2.1`/`2.2` deterministic members are regression-checked against
frozen pre-extension hashes. Canonical data and accepted EPUBs remain fixed. Install matching worker,
Python validator and generated API/web contracts together; qualify the actual reader for the new
capability before accepting a fresh initial import. Package checks establish source and export
behavior, while normal-browser verification remains a separate acceptance requirement.

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

## Source-bound bibliographic refinement

The integrated English/Ukrainian profile can classify short eligible credits on a recognized title
page and its next two pages. A scanned cover may prepare credit comparisons before title
typography is refined; final metadata acceptance still requires refined title-page authority.
It supports author, translator, editor, illustrator, subtitle and
publisher roles; uncertain roles remain unknown. Exact observed text and source crops bind each
decision. Providers select code-point ranges, never replacement names or metadata from filenames.
Locally parsed labels require no classification call. Named frontmatter section boundaries exclude ordinary preface prose; readable sheets coalesce
within the24decision contract limit and split on actual geometry. Separate compact tasks preserve
existing structure-task identities and legacy-profile behavior. Equivalent contributor whitespace merges
identity/evidence while preserving printed text.
This does not implement a complete metadata inventory, all language-specific labels, or credits
without recognized title-page context. Validate accepted fields in both EPUB output and AVA import.

For native opening pages, a short centered printed author component may corroborate the complete
PDF Info author, including a credit followed by bounded edition/date components or finite
English/Ukrainian language names. It must occur
immediately after the source-qualified title, optionally below the first chapter heading, before
ordinary prose. Missing, conflicting or partial names remain candidates. OCR and explicitly
reviewed roles keep their existing authority; this rule cannot override an unknown or translator
decision. Proven affirmative edition and valid ISO-date components retain their exact printed
values, source-edition scope and their own evidence; ambiguous, absent or conflicting components
remain unknown. Qualified native opening credits are excluded from model metadata comparisons
before dispatch. A printed language name is retained as a candidate; the independent complete-source
language pass establishes primary language. A bare printed ISO date retains source-edition scope
without inferring a publication event or year. This local proof requires no provider call.

Native vector-framed asides preserve generic font family, bold, italic and small-caps only when
every visible glyph maps exactly to the retained text, including spaces. Mixed faces retain exact
Unicode ranges and plain resets. Unknown/partial/ambiguous evidence or an excessive run count
leaves the optional typography unknown. This proof does not establish source font size, paragraph
indentation, frame spacing or background appearance. Packaging and normal-reader verification
remain separate from these source checks.

Native block sizes may use a unique body-prose size repeated across at least two pages. Rebase
presentation only after metadata, roles and addresses are established; preserve inline ratios and
original source geometry. Conflicting references, out-of-profile ratios or an exhausted style limit
retain existing values with a finding. Native indentation may fill unknown coordinates only from
complete glyph/line ownership and repeated matching local column/typeface context. Literal block
insets stay separate from first-line indentation; conflicts remain unknown. Neither proof invents
text or creates an OCR/provider request. These source changes need a new packaged worker and fresh
initial-import verification; previously accepted books stay fixed.

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

The integrated isolated worker defaults to 2 GiB/no swap and one CPU for full-book processing.
Canonical and reader wire documents are bounded at 128 MiB; this does not remove source, archive,
resource, hash, semantic or deadline checks. EPUB import finishes EPUBCheck before expanding the
canonical/reader models. See [operational limits](../../docs/pdf-conversion-operations.md).
This is not a hostile multi-tenant service boundary. SQLite on NFS/distributed replicas is unsupported.

## Native paint and heading qualification

Native routing inspects text-affecting clips in their saved graphics scope: an isolated image clip
restored before text does not make unrelated glyphs unreadable. Unknown/compound clips touching
text, hidden or stroke-only text, soft masks and unknown graphics state retain recognition review.
Under the explicitly selected current source-comparison policy, visible fill-and-stroke emphasis
is qualified per glyph in the existing pdfplumber layout pass,
only with thin positive stroke width, matching plain colors, ordinary outline fonts, uniform positive
transforms and undashed paint. It preserves exact native words/ranges; unsupported paint stays reviewed.
Direct DeviceRGB/DeviceGray ink uses the existing source color style; neutral black follows reader ink.
Absent policy/paint fields preserve historical standalone typography and serialized observations.

The same opt-in source policy admits a graphics state containing typed `SA:false` and finite
numeric `SM` in 0–1 when its other entries are already opaque/normal. `SM` is smooth-shading
accuracy, and disabled `SA` does not adjust strokes ([PDF32000-1, Table58 and10.6.3](https://opensource.adobe.com/dc-acrobat-sdk-docs/standards/pdfstandards/pdf/PDF32000_2008.pdf)).
These settings alone do not require OCR of visible, otherwise qualified native text. Opacity,
masks, transfer functions, unknown fields, clipping and text-rendering risks remain conservative;
omitted policy preserves the earlier route. This does not prove a whole book's native fidelity.

The current policy can preserve exact PNG/JPEG source bytes for repeated small, isolated marginal
images explicitly marked Artifact. Positive-axis opaque paint must show the whole image through
known rectangular clips. Images overlapping observed tables, masks, Decode overrides, unknown
DecodeParms/orientation/color and mixed raster prose retain the existing recognition/render route.
Explicit JPEG ColorTransform 1 is accepted only with matching RGB DCT/JFIF appearance evidence. Qualification happens after all pages are prepared,
before model exchange. Every actual occurrence keeps its source box; resource bytes alone may dedupe.
Source-tagged repeated marginal decoration may appear once at its final actual source page, retaining every
original occurrence in page regions and figure/resource evidence. Linked marginal text remains a
source credit, and image link callers retain their original occurrence. Checked direct-page list-body
MCIDs qualify only close hanging-line wraps with compatible visible glyphs; missing/nested/contradictory
structure keeps the previous route. This proves asset identity and intrinsic proportions, not a new
print-relative reader size contract. A single source-marked marginal literal URI underline may remain
native text only with exact ink/color/geometry corroboration; its annotation still passes the unchanged
glyph-range/link validator. Unknown decorations retain the rendered/review path.

Unranked native openings spanning source pages request bounded source-crop heading comparisons.
They remain headings and cannot change typography, discard repeated titles or establish chapters
without complete source-bound decisions. The global parent validator remains strict. A missing
observed heading parent emits `HEADING_PARENT_MISSING` with bounded page/block/geometry provenance;
unknown failures explicitly have incomplete diagnostics. These diagnostics contain no book text.

Under `ava-frontmatter-title-1`, a contents/bookmark title may corroborate one adjacent,
same-page group of heading fragments (up to 16 fragments). The complete title must match
uniquely; grouping never skips body text, crosses columns, mixes native/OCR authority or
absorbs another detected chapter. Case/whitespace and the existing hyphen/en-dash comparison
are navigation-only; an explicit `Appendix N` label may use a colon separator in navigation.
Printed words and punctuation stay unchanged. One resulting heading supplies the complete
chapter/TOC title, while original source regions, native line hashes, annotations, exact link
positions and the first source-page destination are retained. Inline font runs keep measured
size proportions through later typography corrections. Independent line indentation/alignment
cannot be reproduced by one reflowable heading and is reported as
`COMPOUND_HEADING_LAYOUT_REFLOWED`, not claimed as print-layout fidelity. Ambiguous groups or
unrepresentable font runs still require review. A bold, body-sized “Chapter …” label remains
a provisional subsection; complete source contents/outline evidence can promote it to a chapter.

## Deliberate unsupported/review paths

- Annotation policy is shared by admission and v2 preparation. Verified empty FreeText is inert;
  visible passive appearances require recognition and explicit region coverage. Personal sticky-note
  text/popups remain in the original, with content-free information findings; no AVA mark migration.
  A source/policy/output-hash-bound private view excludes those personal objects without changing the
  original. Redactions, hidden/clipped appearances and unrenderable essential content fail explicitly.
  Linked popup/parent/reply annotations receive bounded action checks. Appearance resources share
  worker raster limits, and required appearances cannot become skipped blank pages. Personal linked
  popups are excluded and accounted for; rendering-cache receipts are atomic.
  Coverage requires localized text for text boxes and a localized source-pixel figure for other
  appearances; body overlap alone cannot claim preservation. Genuine Ink/QuadPoints highlight
  fixtures exercise real pixels and selectable prose. Finite inline annotation style transport is
  implemented; wider appearance and full reader qualification remain open. Source-pixel coverage
  alone is not full style fidelity.
  The legacy native exporter refuses visible/personal annotations rather than dropping them.
- Link URI/GoTo and narrowly bounded literal page-jump actions are interpreted as data, never
  executed. External/internal targets require exact source-bound text/geometry mapping. Accepted
  visual text may corroborate unique visible native geometry, allowing only line-edge layout
  whitespace differences with offsets accounted for. Otherwise bounded local word OCR supplies
  geometry without rewriting accepted text. Confidence/visibility/ambiguity gates stay intact.
  Arbitrary scripts/chains/additional actions, scanned table-cell links and unqualified coordinate
  destinations remain explicit review/refusal paths. See [navigation policy](../../docs/pdf-conversion.md#source-bound-pdf-navigation).
  Complete finite `XYZ` viewport origins above or left of an understood unrotated page can
  project onto its first eligible retained source line. Original coordinates remain unchanged,
  and the target keeps its unique owner and exact character offset; it is not a generic page-start
  fallback. This path requires matching page/observation dimensions, full zero-origin CropBox/MediaBox
  and UserUnit1, and excludes omitted furniture. In-page passage/column behavior stays unchanged;
  missing/ambiguous ownership, unknown frames/modes, nonfinite values and no eligible line still refuse.
  Caller glyph/annotation overlap rules remain unchanged.
- Encrypted or unqualified concealed/clipped/rotated content requires safe source handling. Refusal
  does not mean the PDF is corrupt. No hidden text is deliberately exposed.
- Scans need an explicitly configured recognizer or reviewed/replayed extraction. Native extraction
  preserves measured line candidates and flags paragraph order/structure for review.
- Synthetic OCR fonts do not establish original font weight, family or italics. Exact visible source
  glyph runs can corroborate family/bold/italic without rewriting OCR text or existing links. Mixed
  runs require a proven source-region clip; only bounded uncolored-outline Type3 programs with known
  consistent descriptors qualify. Arbitrary painted glyphs, hidden scan layers and ambiguous mappings
  remain unqualified. This does not waive the conservative whole-page native routing guard. See
  [source font roles](../../docs/pdf-conversion.md#source-font-roles-for-ocr).
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
.venv/bin/python -m unittest discover -s tests -t . -v
.venv/bin/ruff check src tests scripts
.venv/bin/mypy src/ava_pdf_epub
```

Tests include text preservation, styles, chapters/TOC/notes, traversal/unsafe links, malformed inputs,
real SQLite connection races, cancellation, stale leases, restart, corrupted checkpoints, budget
reservations/unknown charges, and conservative source handling. The task's actual supplied-book
measurements and review findings live in the
[worker verification guide](../../docs/pdf-conversion-verification.md). Historical standalone evidence does
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
Projection `ava-epub-canonical-2.4` gives the opening/title and each accepted major H2 section
its own XHTML/spine file. Boundaries follow direct TOC children of one H1 logical chapter root,
not PDF pages, inferred titles or nested subsections. Logical chapter membership, heading ranks,
text/offset identities and source aliases stay fixed. Lists/items remain whole; a boundary that
would divide a figure/table from its caption or credit is kept within one file. TOC links,
notes/returns, text offsets and source-page links use the target block's actual publication file.
Current section exports with a nonzero declared list-body indent or inset use
`ava-epub-canonical-2.5`. Neutral or unknown list geometry retains the previous default page/section
projection; a marker style alone does not select 2.5. Explicit 2.5 remains available. It retains the
section/link rules and places body indentation on a separate block inside each item; the semantic
marker keeps its independent font and color. With explicit
`source_feature_policy: "ava-ocr-source-features-1"`, the pinned worker measures native body glyphs
after the printed prefix,
using uniquely owned visible rows and each list/depth/page/column's body baseline. Existing Style
fields retain real body displacement and nested structure without counting the marker gutter twice.
Ambiguous geometry and OCR body styles are not reinterpreted. The API's normal reconstruction request
already selects this policy; package and worker/config fingerprints bind the effective implementation.
Profile `ava-epub-canonical-2.7` projects already raised/lowered Unicode digits without adding
same-family script placement again. It preserves canonical characters, style records, explicit sizes,
source coordinates and one link per occurrence. Ordinary digits keep script styling; opposite-family
or conflicting placement and adjacent combining/joined sequences keep the existing projection.
Default current-policy exports select 2.7 only when this correction applies; the historical
`split_sections=False` policy keeps its older projection, including its older script rendering.
Explicit 2.7 includes the section/list/literal-label projections. Profiles 2.1–2.6 retain exact
historical bytes when explicitly selected or reimported; portable validation reproduces the declared
profile rather than upgrading an existing EPUB.
Reconstruction with the historical omitted `source_feature_policy` retains its old chapter
projection and canonical geometry; the current policy enables section files and native list-body
normalization. The reader's body wrapper preserves existing accepted style values and removes the
observed marker collision without rewriting content; it cannot prove legacy per-row alignment.
For a negative declared body start, body-only padding reserves marker clearance while retaining the
signed first/continuation displacement. This is display safety, not recovered source geometry.
`conservation_report` describes the default candidate projection unless its `profile` argument
selects a specific historical projection; it does not infer a supplied EPUB's declared profile.
[Content checks and limits](../../docs/pdf-conversion-verification.md) distinguish authored-fixture conservation
from PDF reconstruction, ordinary import, publication and renderer qualification.

The opt-in [durable runtime](../../docs/pdf-conversion-operations.md) wraps admission, reconstruction,
generated-EPUB reimport and EPUB validation in a pinned container with network denial, resource
quotas and a lease-expiry supervisor. Reconstruction streams hash-checked canonical/EPUB/resources
to the host as a candidate. Only separate source validation, required review and a qualified reader
permit the host to publish one immutable Ready book. Standalone legacy canaries remain candidates.
Host-side provider dispatch exists behind explicit route/source/budget authority; no live route is
enabled merely by starting the ordinary worker, and no model call occurs inside this container.

### Finite reconstruction attempt

`reconstruction_v2` also accepts `attempt_stream` in the fixed
`/input/reconstruction-request.json`. The exact startup object contains `mode` and `input`;
`input` is `ava-reconstruct-input-1` with explicit registered `profile_id`, the SHA-256 of
`/input/source.pdf`, and empty `responses` and `refinements` arrays. Optional
`source_feature_policy: "ava-ocr-source-features-1"` selects the current finite comparisons;
omitting it retains the historical policy. Provider authority remains with the host.

the separately captured, opt-in `source_layout_policy: "ava-native-layout-1"` uses
`ava-reconstruct-input-3`. It requires the current source-feature policy and complete-source
preparation before any host/model exchange. Every private checkpoint and announced page uses
`ava-prepared-page-2` / `ava-prepare-result-2`, including pages with no recognition tasks. Policy,
source identity and exact native text ownership are rechecked during reconstruction; historical
input1/input2 and page1 packets keep their original no-layout-policy behavior.

The same explicit native-layout policy can retain a private uniform-ink witness for
complete direct-page text paint. It compares every source painter state with the
actual annotation-view PDF objects and an independent, strict sampled-tint/ICC
conversion. Mixed, missing, transparent, clipped, Form, Type3 or unsupported
paint retains the existing review route. Resolved sRGB populates the existing
derived glyph colours before the first checkpoint; raw PDF operands remain
unchanged. Final reconstruction recomputes the source proof against saved raster
bytes and verifies every glyph/line/segment/span colour overlay, including witness
erasure. Default policies, public task schemas and existing editions remain unchanged.
pypdfium2 SDK 5.13.0 is now a direct dependency using the existing locked archives; this
source capability still needs the installed-runtime and original-source gates.

This first deterministic layout policy considers whole-book running furniture before columns,
preserves qualified isolated ornament rows, and groups source-corresponding Contents labels and
folios. Grouped lines retain exact codepoint offsets and glyph span styles; printed Contents still
must agree with actual source openings and folios. It requires visible, aligned glyphs, known font
roles and known source ink; missing ink is not assumed black. Unknown styles/colour spaces, hidden
text, mathematical operators and ambiguous rows keep the existing recognition/review route.
Per-page preparation cannot opt into this complete-source policy. The separate captured
`ava-native-structure-1` opt-in adds IDs-only structure decisions after exact native qualification;
unsafe glyphs or source partitions retain the unchanged recognition fallback.
NativeTask1/Response1 retain the same schema, prompt and captured policy. Immutable task regions
and line IDs own reading order. A complete response whose whole groups arrive in another collection
order is validated through a local source-ordered clone; every group must already contain a
consecutive source-ordered run within its exact region, and complete unique ownership must match.
Reversed, missing, duplicate, foreign or nonconsecutive line IDs still refuse. Canonical order also
feeds assembly, list look-ahead and confirmed continuation checks. Original response objects/bytes
and classification provenance remain unchanged; no text, group attributes or source IDs are repaired.

Controls use a four-byte unsigned big-endian length followed by UTF-8 JSON. Every
`ava-reconstruction-exchange-1` envelope has exactly `schema_version`, increasing `sequence`,
`source_sha256`, `profile_id`, `kind` and `payload`. Replies repeat the same envelope binding.
Captured Input5 uses `ava-reconstruction-exchange-2` for generic controls, followed by an
acknowledged `word_wrap_batch` and its ordered `word_wrap` task controls after refinements.
Native structure and anchor context controls retain their own original namespaces and sequence
limits; the new generic namespace allows at most 25,600 controls with the existing byte caps.
Each word-wrap reply contains one separately typed WordWrapResponse; batch replies are `[]`.
Even an empty catalogue is acknowledged before artifacts.
Only one exchange is outstanding; unknown or duplicate keys, wrong binding/order, oversized
messages, truncation and unexpected EOF are refused.

| Worker control     | Payload                                                                 | Host reply                                                |
| ------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `page`             | Prepare1/Prepare2; captured Input4 uses typed native/OCR Prepare3 tasks | `[]` acknowledgement                                      |
| `recognition`      | `{ "task_id": "…" }` from that page, in task order                      | One existing recognition response in a list               |
| `native_structure` | `{ "task_id": "…" }` naming an advertised native task                   | One separate native structure response in a list          |
| `refinement_batch` | Unchanged `RefinementBatch`                                             | `[]` acknowledgement                                      |
| `refinement`       | `{ "task_id": "…" }` from that batch, in task order                     | One existing refinement response in a list                |
| `artifacts`        | `null`                                                                  | None; subsequent stdout uses the existing artifact stream |
| `refusal`          | Existing typed source diagnostic or generic reconstruction error        | None; worker exits `1`                                    |

The separately captured `ava-native-structure-2` policy uses closed NativeTask2/Response2,
Input8 and Prepare5 on the existing full Layout1, WordWrap1, geometry-repair1 and
complete-title1 feature stack. It requires an explicit server opt-in through the existing
source-structure selector; historical/builtin Structure1 configuration and all Input1–7,
Prepare1–4, Native1 schema/prompt objects remain unchanged. No additional model tasks or
retries are added and every existing request, image, context, output and money bound remains.

Response2 groups are closed role-specific `anyOf` branches. String `heading_role`
chapter/section and `list_role` ordered/unordered determine applicable metadata: a chapter
has fixed level1 and a chapter role; a section has only its rank; an ordered item requires a
printed ordinal; an unordered item cannot supply one. Nonheadings cannot supply chapter
fields, and note/list/continuation/relationship fields exist only on their applicable roles.
The pinned semantic validator still checks printed markers, native ownership, source styles,
ornaments, furniture, boundary adjacency, callouts and complete source coverage. A private
validated decision view derives those explicit role semantics for assembly without changing
wire identities or manufacturing Native1 receipts. Normalization classification hashes the
original typed Response2, including its original group collection order.

The separately captured `ava-recognition-geometry-repair-2` policy uses Input9 on that
same complete feature stack. It retains segment repair and adds one bounded correction for
empty/reversed, unpinned OCR table-cell boxes. A cell task contains at most32 opaque slots,
original row/cell array addresses (including merged cells), limited row context and the exact
source image. Only requested boxes may change, and each must remain inside the original table.
No endpoint sorting, retranscription, row/span changes or measured-cell replacement is allowed.

Before dispatch, the installed worker rederives eligibility from the original response and
source task, including complete native/text/table checks. Cell, segment and anchor corrections
share one parent opportunity and durable billing identity; switching repair types cannot obtain
another attempt. Unresolved or invalid replies fail the import. Final Input9 proof replay checks
the original bytes, exact patches and complete corrected page again. The canonical book and EPUB
contracts remain unchanged; older Input1–8 captures do not acquire cell-repair authority. Source
and authored test evidence alone does not establish full-book fidelity or release readiness.

Input8 keeps the existing generic exchange2 sequence and byte counters. Its native controls
use `ava-native-structure-exchange-2` with the unchanged native25534 sequence bound; old native
exchange1 cannot answer them. Worker checkpoint5 is source-bound and cannot be reopened or
used as a historical checkpoint. These authored/source-preservation checks do not establish
an accepted provided-book conversion; the original failed Native1 receipt remains refused.

Captured Input4 uses `ava-native-structure-exchange-1` only for `native_structure` task controls.
Page announcements keep Exchange1 and carry Prepare3; its typed native/OCR task order is exact.
Native responses contain source-line groups, eligible note-callout span IDs and pinned boundary
dispositions. Replacement text, geometry and styles are forbidden. The model receives a finite
line/region/callout/boundary view; full measured spans and source snapshots remain private.
Native and OCR tasks share the existing 50/page, 25,000/attempt and aggregate payload limits.
Historical page packets and task markers cannot acquire native decision authority.

An opt-in native-layout attempt may emit the distinct
`ava-recognition-anchor-context-exchange-1` / `anchor_context` control after an otherwise
valid recognition reply fails only an exact-anchor context check. The original Exchange1
kinds and final Input3 shape remain unchanged. The correction has its own versioned task,
response and prompt. It may change only `before`/`after` at the identified slots; quoted text,
styles, links, transcription, geometry and ordering remain fixed. Both the producer and a
source/job/lease-bound parser-only `validate_anchor_context` host check reject unrelated
page, region, reference or native-conservation failures before spending.

There is at most one correction pass per parent reply. The API preserves the original and
correction provider payloads separately and uses a stable parent billing key, so a changed
or uncertain repeated request cannot authorize another call. Corrections consume the existing
operation request and funding limits; they do not add a request slot or skip required work.
The control keeps the existing 8 MiB page bound; provider request/response and aggregate reply
limits remain unchanged. After a context-only overlay, full original task/response semantics
run again before the corrected parent enters its captured Input3 or Input4. Unresolved context remains a typed source
refusal. This is part of an active initial conversion; it never retries or replaces a Failed book.

The worker admits tasks before announcing them and semantically accepts each response before
requesting the next dispatch. Task controls do not repeat images. After the last refinement
reply, or an empty batch acknowledgement, the host closes stdin; the worker requires EOF before
emitting artifacts. Existing per-task and aggregate payload limits remain enforced; exact frame
bounds are in [the codec](src/ava_pdf_epub/reconstruction_v2/attempt_exchange.py).

Each page is prepared once into attempt-private, hash-checked checkpoints. Whole-source annotation
admission precedes the first page/task control. Original/view identity checks and bounded checkpoint reads
continue across phases; decoded caches are cleared and response/assembly state is recreated for
final reconstruction. The two-page parser windows remain, and parsers retire before host waits.
This reuse introduces no cross-attempt cache and does not imply one PDF open or eliminate later
source metadata/link reads. `prepare`, `prepare_refinement`, `reconstruct`, `reconstruct_stream`
and the standalone validators retain their existing interfaces.

The single `prepare_source` timing phase covers active upfront preparation and excludes host
response waits. Whole-command `work_ms` includes those waits and still excludes interpreter startup
and observation export. Other phase intervals remain inclusive and must not be summed. The
attempt reuse observation describes private checkpoints, separately from decoded-cache hits.
This interface does not qualify an installed runner, provider, supplied corpus or production release.

Annotation admission refusals carry a stable `PDF_*` code and bounded, content-free `finding`
location: one-based `page_number`, optional `annotation_number` and a related-object path
(`/Popup`, `/Parent`, `/IRT`, at most 20 steps). Source-order traversal makes the first refusal
reproducible. Parser exception text and annotation contents are not emitted. The API validates
the same bounds and preserves the location in its refusal response. This response is not yet a
durable conversion log; PDF-18 owns persistence and operator investigation.

### Finite annotation style transport

Canonical styles now carry optional lowercase six-digit hex `color`/`background_color`/`decoration_color` and
nullable boolean `underline`/`strike_through`. EPUB CSS, AVA inline rendering and exact generated
EPUB reimport preserve these observations. Unknown new fields are omitted from serialized styles
so pre-extension book digests and deterministic EPUB bytes remain unchanged; explicit false resets
are retained. Colors cannot contain arbitrary CSS or resource URLs. Referenced extension styles
require the additional `annotation-styles` reader capability, not merely baseline `styles`.
Older qualifications cannot authorize that content. Worker, API and web generated types must be
updated together; the API contract generator now checks/emits the shared web reader types too.

Native Highlight, Underline and StrikeOut quads now map through source glyph geometry to exact
Unicode spans, preserving emphasis and link destinations. Multiple quads do not style intervening
unmarked text. Explicit RGB and grayscale colors and continuous strokes are checked against rendered source pixels;
highlights retain contrasting source glyph ink. Reliable native marks need no model call. Partial
glyph boundaries, conflicting overlapping colors and ambiguous text mappings require review rather
than guessed offsets. OCR segments now use independently observed Tesseract word boxes for inline
annotation localization. The worker pins Tesseract 5.3.0 and English/Ukrainian traineddata. Legacy English v2
uses `eng`; the opt-in bilingual profile uses the fixed `eng+ukr` inventory for scanned word
localization. Source hash, confidence, visible-pixel and exact-offset checks remain; no provider call is
needed for word geometry. A source-hashed private PDF view excludes only inline Highlight,
Underline and StrikeOut objects for local word localization; the original PDF and its rendered
appearance remain unchanged. Authorial textboxes and other required appearances remain in that view.
This avoids annotation strokes obscuring the OCR input without erasing and reconstructing letter
pixels. An original-raster visibility check additionally requires at least half the observed glyph
ink to remain visible before a selected word can receive markup; an opaque cover cannot authorize
underlying prose merely because the private view removed its annotation. This check is a conservative
mapping gate, not a general proof of transcription accuracy. Near-exact corroborated highlight-fill
treatment remains confined to declared regions; there is no global luminance threshold.
The image hash/dimensions are checked before execution; timeout is
20 seconds, output is capped at 4 MiB, and native diagnostics are suppressed. Matching is exact
Unicode with whitespace-only alignment, unique geometry/text correspondence and confidence checks.
After a strict native link-caller mapping refusal, one complete, isolated native line
can use local word geometry from an exact crop of its unchanged source raster. This
path requires known upright geometry, visible glyphs, no source risks or inline
appearance regions, one retained native owner, exact whole-line Unicode tokens and
source offsets. The parser validates all rows and records the crop origin explicitly;
word coverage and confidence thresholds remain unchanged. Character accounting
refuses added ignored punctuation and omitted partial adjacent glyphs. A midpoint
outside the caller is only a conservative refusal for a partial glyph, never
acceptance authority. Native text, style and method remain unchanged, and target
qualification is separate. The primary native and scanned-page paths retain their
existing rules. At most two private contexts are cached per source page.

Private OCR PNGs preserve measured physical resolution from source page geometry; dropping this
metadata can cause automatic OCR to omit clearly visible ruled-table words. Pixel content is not
rescaled by this metadata repair. Scanned table-cell marks use fully contained independent word
boxes and exact cell-local text offsets; a printed line crossing columns cannot style the gap or
neighboring cells. Ambiguous/partially bounded cell mappings require review. Existing header
association requirements remain in force.
Partial words, duplicate matches and inconsistent text require review. A packaged true-scan fixture
and authored transcription oracle establish scoped reconstruction/reimport evidence, not live VLM
transcription quality or general scanned-book support. Wider appearance/color cases remain unfinished.

This is source mapping and finite transport, not full product qualification. Actual normal reader
flows for the remaining appearances at dark/light themes and large text, broader live annotation OCR
and independent review remain required
before declaring annotation conversion supported. Source-pixel crops alone are not the final
inline-style representation.

### Native visibility and Ukrainian extension status

The v2 observer can qualify an enclosing single identity rectangle and strictly inert Normal/opacity-one
graphics state. It still reviews partial/compound/Form clips, masks, offsets, rotation and unknown state;
native ink checks remain independent. The opt-in `ava-pdf-prose-en-uk-v3` profile carries source-derived
language evidence through preparation, canonical content, EPUB metadata and reader language tags.
It requires explicit accepted book language and passage tags; conflicting catalog metadata is retained.
Authored native single/two-column fixtures verify exact text, chapters, TOC and canonical reimport.
Legacy English v2 behavior/serialization remain unchanged. Full Ukrainian native/scanned/mixed and
supplied-book normal reader qualification, independent review and production activation remain open.

The bilingual annotation localization change requires a newly built worker image and actual
scanned Ukrainian fixtures before installed support is claimed. The earlier native profile image
does not contain Ukrainian traineddata. Package version: [Debian Ukrainian OCR data](https://packages.debian.org/bookworm/tesseract-ocr-ukr);
fixed multiple-language invocation follows [Tesseract CLI documentation](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html).

Source-cover candidate: a single first-page `cover` render layer may overlap selectable title
text while ordered content bands retain their original validation. The layer must be bound to
the identified cover resource. After the existing first-page title/artwork qualification, the
cover retains the full first-page render, including separate raster strips and page edges.
Cover extraction does not rewrite selectable text. The integrated publisher uses the validated
resource in the first private
PDF publication and serves it through an owned Library cover route. Normal reader qualification
must be refreshed with the changed structural contracts before activation.

Page checkpoints retain at most two decoded observations within32MiB aggregate serialized bytes.
Every read, including cache hits, rechecks the private-file snapshot and hash; eviction bounds
remain enforced. This avoids redundant first/destination-page decoding without enlarging the
former aggregate serialized cache bound. Geometry-only passes use validated scalar projections
and still verify checkpoint identity on every access. Native spans allocate validated models per
identical contiguous style run rather than per glyph; text, whitespace, offsets and style IDs remain
unchanged. A frozen126-page offline replay completes in794.274s versus1310.294s, with the entire
canonical JSON, EPUB and cover bytes identical. This local result does not qualify normal Library
publication, all books, independent review or source/reader fidelity.

### Whole-book time and paired native lines

The candidate total job deadline is bounded at120minutes/7200seconds across durable job policy,
sandbox admission and the generated worker contract. Extraction, model review and assembly share
this deadline; lease renewal does not extend it. Existing jobs keep their captured shorter policy.
A normal126-page test exhausted its former30-minute ceiling after extraction; retain this failure
separately from RESOURCE_LIMIT/OOM and from successful offline assembly. The larger ceiling is
headroom pending corpus measurements, not a promised time for every supported book. Monetary
limits are separate and remain enforced before dispatch.

Source-corroborated native comparison runs preserve printed pair line breaks as paragraph text.
The bounded guard requires a broad body reference, aligned lines, matching known typography,
five pairs and two distinct exact repetitions. It keeps all words/repetitions and existing spans,
without declaring a table or poetry. A private marker retains newline joins across pages and
prevents mixing with ordinary prose. Isolated/unconfirmed pairs are not automatically classified.
Authored canonical/EPUB/reimport controls and original pages97/98 checks pass; full new-candidate
normal import and reader/source qualification remain required before completion.

### Unmarked display rows and poetry

Three to twelve native items introduced by a colon and separated by semicolons can retain
intentional row breaks in a paragraph. The bounded rule stays within one source page/column,
matching typography and at most 24 source lines. Items must be indented, or margin-aligned with a
visibly separated introduction. A wrapped final item uses a normal layout-space join.
It preserves text/spans and measured inset without inventing list markers or declaring poetry.
This is source-delimited display preservation, not support for every unmarked list or semantic proof
that a colon/semicolon sequence cannot be poetry. Other source patterns keep their normal routing.

Punctuation and close line geometry never directly establish verse. Isolated native line groups,
including strongly separated groups at the body margin, remain source-crop role candidates.
A source-backed decision distinguishes verse, quoted prose and ordinary paragraph text; missing
review remains a blocking finding. True poem/quote and activity controls preserve canonical text,
styles and exact EPUB reimport. Current full-book normal import/source/reader qualification remains
required; historical accepted content stays fixed.

### Printed identifiers and uncertain edition records

Explicit ISBN labels can occur inside a source paragraph without a colon. New discovery validates
ISBN10/ISBN13 checksums, supports bounded parenthetical label qualifiers and printed groups with
Unicode hyphens, nonbreaking spaces or line wraps, and keeps newly
embedded claims as candidates unless existing labelled bibliographic authority establishes them.
A short eligible frontmatter/bibliographic record ending with a bare valid ISBN can retain that
identifier and its directly adjacent printed year as source-edition candidates. Arbitrary body
numbers, phone/order labels and attached word-years do not establish these claims. Printed year,
ISBN and publisher are not automatically combined into one accepted edition. Source words and
positions stay fixed; only identifier spelling is normalized in the metadata claim.

Matching candidate metadata retains the actual printed block's evidence even when PDF Info already
contains the same ISBN; merging evidence does not promote certainty or collapse different scopes/
schemes. Candidates survive generated EPUB reimport but are excluded from accepted OPF metadata.
The generated EPUB identifier remains its conversion URN, not the source ISBN.

### Language-only uncertainty

In the opt-in English/Ukrainian profile, uncertain language alone does not request a new
transcription of reliable native text. Keep its measured typography and source finding.
The unchanged whole-book validator still requires a source-supported primary language
covering at least80percent of source letters; uncertain or foreign passages retainund tags.
Other extraction/visibility/annotation risks, missing native text and text-bearing rasters
still require recognition. Legacy English routing is unchanged. This avoids introducing
guessed OCR styles solely to identify language; it does not qualify other primary languages.

Embedded raster text uses bounded, aspect-preserving pixel analysis and separated character-run
evidence, including short prose/verse and dark-background text. Ordinary solid shapes, bars and
ruled grids do not become text merely because they have horizontal bands. Eligible regions receive
source-bound recognition tasks covering each complete connected native graphic group, including
adjacent vectors and source padding. Shared groups are reviewed once; groups reaching native text
use the complete-page safety route. Native roles, joins and styles are measured with source layout
barriers intact before reviewed regions are excluded. Text-like outlined symbols can also request
bounded visual review. An accepted figure retains source pixels; an empty response is refused.
Uniform near-white blank pages need no recognition; nonblank running furniture remains an explicit
source observation even when whole-book assembly omits it from reading text.
The detector selects visual review candidates;
it cannot prove transcription fidelity or complete source-text recall. Tiny/ambiguous single-stroke
images retain source pixels rather than guessed text. Installed worker and normal mixed-book
qualification remain required before claiming broader support.

Source typography uses `indent_em` for first-line displacement and optional `block_indent_em`
for the entire paragraph inset. Native multiline insets and source-qualified comparison boundary
fragments preserve the latter; other single lines stay ambiguous. Unknown block indentation is
omitted from wire output so legacy immutable digests remain unchanged. EPUB uses
`margin-inline-start`; AVA maps the same value separately from `text-indent`.

Structure comparison uses versioned prompt5: every heading has an explicit boolean chapter
flag, sections use false and a null chapter role, and non-headings use null fields. Historical
prompt3 remains immutable for its tasks; bibliographic prompt4 is separate. Invalid decisions
are rejected before assembly, with their provider cost retained. A prompt revision changes task
identity; an old response cannot be edited or rebound to a new task. This preserves finished
content and does not introduce later reconversion.

The mixed-heading candidate uses prompt6 only when native heading ancestry cannot be inferred
through an OCR heading with no measured native size. Those native headings retain blocking
findings and become explicit source-crop decisions with `candidate_original_kind:heading`.
They must remain headings with null decision style; native text/spans/typography cannot change.
Missing, unresolved or invalid parent decisions still refuse reconstruction. Outline/Contents
ranks and native-only hierarchy controls remain fixed. Historical prompts3/5 stay byte-exact.
Preparation is not acceptance; a refreshed installed worker and normal-import/reader verification
are required before claiming this candidate resolves a real mixed book.

### Bounded merged table cells

Canonical cells may carry positive `row_span` / `column_span` within the existing20×8 grid.
Default1 is omitted from the wire to preserve legacy ordinary-table digests. Validation requires
row-major physical origins, exactly one owner per logical slot, in-bounds spans and exact
span-aware header relationships. EPUB exports selectable th/td with rowspan/colspan; AVA's
ordinary and bilingual views preserve spans and rows covered entirely by earlier cells.

Ruled PDF rectangles qualify merged origins; the existing borderless pattern retains separate
geometry and does not acquire guessed merges. Unqualified visual tables route as complete tables.
Pinned geometry was introduced by `ava-prose-region-4`; new span-bearing tasks select
`ava-prose-region-16`, retaining historical region2–14 prompt bytes. The source-bound task pins
measured physical origins/rectangles and cell IDs, including
blank cells. OCR returns text/styles against those IDs with `box:null`; acceptance binds the exact
measured geometry and rejects unknown/duplicate IDs, changed spans or missing physical cells.
This avoids asking the model to redraw ruled cells, especially intentionally empty ones.
OCR must preserve their count, spans and unique geometry match; missing/duplicated/guessed cells
are refused. Source glyphs crossing native cell boundaries require visual review.

This implementation is a candidate. Installed whole-book, live OCR, semantic header/accessibility,
normal PDF publication/reimport/reader and independent review remain separate acceptance gates.
Update installed host validators, generated API/web contracts and worker images together before
using new span-bearing candidates. Finished books are never reconverted or replaced.

### Exact inline text anchors

New recognition tasks use `ava-prose-region-15` for prose and `ava-prose-region-16` for pinned
ruled-table geometry. Inline spans quote `anchor.exact_text` from their own segment/cell;
`anchor.before` / `anchor.after` provide exact adjacent context when a quotation repeats.
The host computes Unicode code-point positions without changing transcription. Ambiguous or absent
quotations and mixed numeric/quoted authority fail acceptance. Historical region2–6 tasks continue
using numeric offsets and their original prompt bytes. Region7/8 remains the historical initial anchor prompt; region9/10 adds complete style-run
boundary instructions, including plain connectors and punctuation. Region11/12 adds source-grounded
character/typography distinctions and a final unique contextual-quotation check. Raised/lowered
ordinary digits remain ordinary text with explicit sub/super spans; intrinsic Unicode characters,
emoji, combining marks and ligatures are preserved. No NFC/NFKC conversion, host text repair or
automatic provider retry is added. Absent/ambiguous quotations remain refused by the unchanged
strict semantic checks. Region13/14 additionally requires every decimal, alphabetic or Roman ordered
item's own observed integer ordinal, including nested items and page continuations. The exact printed
marker and depth remain source observations. An unreadable essential marker uses an unsupported
region plus unresolved; unordered bullets retain a null ordinal. Gemini's supported generation grammar
describes this condition, while canonical and worker checks enforce it independently.
Region15/16 requires source character selection first, then finalized segment/cell text, followed by
verbatim inline quotations and exact adjacent-context self-checks against that same text. Reliable
native evidence conserves character identity; raster-only ordinary raised/lowered characters use
ordinary reading text plus placement styles. An intrinsic Unicode glyph does not gain another
sub/super style merely from its shape. Essential unknowns remain unresolved. The response schema
describes this ordering at text and anchor fields, including cells, notes and links; Gemini grammar3
preserves these descriptions. Cross-field exact quotations cannot be enforced by the provider's
supported JSON grammar, so the existing strict worker checks remain authoritative. A received
contradiction is refused without folding, repair or replay.
A prompt clarification is not proof of source fidelity or live model behavior. Historical region2–14
prompt bytes remain exact. New anchored responses cannot
reinterpret old tasks. Styles are explicit objects, never implicit string IDs.

Exact offsets establish positioning, not visual accuracy: compare complete emphasized phrases,
notes and links against rendered source pages before qualifying a model/profile. Installed validators,
generated API contracts and worker images must be refreshed together. Do not treat schema acceptance
as proof that the model observed every styled word or that a full book is ready for publication.

### Bounded OCR geometry correction

The server-only `ava-recognition-geometry-repair-1` policy selects closed Input6 on top
of Layout1, Structure1 and WordWrap1. It retains exact original OCR output and permits
one correction of empty/reversed segment boxes through a distinct geometry task and
response. Only the requested boxes may change, within the original source crop; the
worker replays the original receipt and validates the complete patched response before
advancing. Geometry and inline-anchor corrections share one correction opportunity.
Historical Inputs1–5 and source cover qualification remain unchanged. The policy is
opt-in and requires matching captured configuration, worker and provider authorization.

Input6 OCR replies use private `ava-recognition-attempt-reply-1` to bind the exact original
provider output before host color-case normalization. Repair controls use
`ava-recognition-geometry-exchange-1`; the `validate_geometry` command independently
regenerates eligibility before dispatch. Model requests expose the original image and
only the requested segment IDs, roles and short contexts. The complete original output
stays private, and the final input retains a replayable geometry proof.

### Complete frontmatter title comparison

The server-only `ava-frontmatter-title-1` policy selects closed Input7 and
`ava-book-refinement-batch-3` on top of the captured Layout1, Structure1, WordWrap1
and RecognitionRepair1 policies. One Title2 task compares at most 24 unchanged source
headings within the first 16 pages before a proven body/Contents boundary. It uses
readable title/page-context panels at 2 pixels per point, with each panel bounded at 2048 pixels per edge,
the complete sheet bounded at 4096 pixels per edge and 4 MiB. Overflow refuses; no catalogue,
source text or image panel is truncated to fit.

The response selects one whole source node by ID/hash with its exact title/context
evidence, or declines. Completeness is a source comparison judgment; the number of
large OCR headings does not prove a title is partial. Cover corroboration is separate
and requires exact first-page heading/context evidence. The selected title does not
change typography, chapter roles, selectable text or reading order. The task shares
the existing 32 refinement slots and provider grant/spend caps. Historical Title1,
Inputs1–6 and Batch1–2 stay closed. This opt-in requires matching generated contracts,
worker, semantic validator and provider authorization before corpus/reader qualification.

### Host recognition wire version 2

Gemini recognition requests `ava-recognition-observation-2` with a closed, single-shape
generation schema. Native structure retains its existing JSON mode. The recognition grammar
requires an explicit `chapter_start` decision on every segment and admits only declared style
keys. It omits array-size maxima from provider generation because the tested provider rejects
the complete schema with those maxima; the unchanged host and worker still enforce them.
The full response contract remains prompt guidance and authoritative acceptance validation;
provider schema compliance alone does not establish source fidelity. Its sparse style
contract prefers `family`; it also accepts the finite spelling `font_family_role` for exactly
`serif`, `sans-serif` or `monospace`, only when `family` is absent. The host projects that one
explicit value to canonical `family`, preserving text, anchors, indentation and every other field.
Both names together, invalid alias values, model-supplied style IDs and other unknown keys remain
errors. Canonical schemas and the Python worker are unchanged. New prompt/schema bytes change the
exact request hash; old observation-1 receipts are not reinterpreted or published. This is format
compatibility, not source verification or permission to change finished content.

Recognition observation-2 also permits omitting segment `method`: OCR provenance is fixed by the
exact prepared recognition task, so the host supplies only a genuinely absent value. Explicit
`ocr` is retained; null, conflicting values and malformed values still fail canonical validation.
This does not fill missing text, geometry, style or semantic roles. Updated generation prompt/schema
bytes change the request fingerprint; settled receipts cannot be reused under a different request.

Schema failure reports include missing core segment fields and only the applicable conditional
chapter/list requirements. A section heading does not require `chapter_role`; a true chapter start
does. These diagnostics remain bounded and exclude book text and untrusted field names.

### Missing figure descriptions at the provider boundary

Gemini observation-2 has one bounded recovery for genuinely omitted figure `alt` fields.
After the original call is settled and its raw response saved, the host checks a disposable
copy with internal placeholders to establish that every other host schema/binding/refusal
check passes. Placeholders never reach the worker. Null/invalid alt, malformed JSON, duplicate
segment IDs, unrelated schema errors and unsupported/unresolved content remain failures.

If the route explicitly allowlists `ava-figure-alt-observation-1` and
`ava-figure-alt-response-1` using the exported prompt/schema in the API provider's
`figure-alt-contract.ts`, the host may request descriptions for up to eight missing figures
in one call. It sends the same source image and exact figure boxes/internal labels. The child
request records the original call ID, request/task/output hashes, source and render hashes.
Its stable task ID permits reuse of the same settled correction, not another paid opportunity.
Normal grant, cancellation, request-count, reservation, settlement and uncertain-charge rules
apply. Routes without these hashes refuse the additional request; no policy is broadened automatically.

A corrected response must cover exactly those IDs in order with nonempty descriptions. The
host patches only previously absent alt and reruns the full existing decoder and worker checks.
All other observations and both raw receipts remain fixed; the patched response is a derived
combination of two observations. The returned receipt retains the original call's cost and
identifies `repairCallId`; aggregate cost comes from the ledger containing both calls. No
transport retry, recursive repair, provider fallback or restart of a terminal Failed import is
introduced. Source fidelity still needs visual verification; schema validity cannot prove a
correct description. An unresolved or invalid correction remains Failed.
