# PDF conversion

During PDF import, a reader can select **Convert to EPUB**. AVA creates one Library entry after
durable upload, shows preparation status there, and makes the finished book readable only after
validation and publication. The same entry offers the unchanged original PDF and accepted EPUB.
Conversion happens once at import; finished content is fixed. There is no later conversion or
replacement. AVA funds processing; readers have no price, credit, API-key or funding step.

The required delivery scope is English and Ukrainian reflowable prose in one or two columns,
including native, scanned and mixed PDFs. The default import profile remains English v2. An opt-in
English/Ukrainian v3 profile is implemented across worker, API, canonical content, EPUB metadata and
reader language tags. An authored native Ukrainian import/Read/EPUB round trip passes scoped tests;
full supplied-book and scanned Ukrainian reader qualification remain unfinished;
scanned/mixed conversion is not yet release-qualified.
Supported content includes chapters, nested Contents, ordinary typography, illustrations/captions,
notes/references, simple lists/tables and short verse/code. Reflow preserves meaningful styles and
reading order, rather than reproducing print-page geometry or promising exact fonts.

## Pipeline and responsibilities

| Stage                 | Responsibility and checks                                                                                                                                                                                       | Source                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Admit                 | Authenticate ownership; enforce file/page/resource limits; bind upload intent to immutable source/configuration; create one owned item and operation.                                                           | `apps/api/src/library/pdf-import/{admission,operations,artifacts}`            |
| Execute               | Durable queue, registered worker/image, short leases and fences; bounded internal preterminal recovery; account/delete/revoke checks.                                                                           | `apps/api/src/library/pdf-import/jobs`, `apps/api/src/pdf-conversion/runtime` |
| Inspect and recognize | Inspect every page/region; trust native text only against visible geometry/content; route missing or unreliable regions to explicitly configured recognition. Native-only books need no model call.             | `packages/pdf-epub/src/ava_pdf_epub/reconstruction_v2`                        |
| Reconstruct           | Conserve accepted text and source evidence; resolve columns/joins, global chapter/heading ancestry, notes, images, metadata and styles. Targeted book-level decisions cannot rewrite prose.                     | `reconstruction_v2`, host `apps/api/src/pdf-conversion/reconstruction`        |
| Assemble              | Canonical `ava-book-2`, separate chapter XHTML/spine, nested TOC, allocated link targets/backlinks, owned resources and finite shared CSS; preserve generated-edition identity separately from print metadata.  | `packages/pdf-epub/src/ava_pdf_epub/{contracts,epub_v2}`                      |
| Validate/review       | Verify source coverage, graph/resource hashes, conservation and EPUBCheck separately; retain blocking versus reviewable findings. Authenticated ADMIN decisions cannot waive hard blocks.                       | `apps/api/src/library/pdf-import/{publication,reviews}`                       |
| Publish               | Fresh transaction rechecks ownership, generation/fences, complete artifacts, provider settlement, review and qualified reader capabilities. Exactly one accepted manifest/final content identity becomes Ready. | `apps/api/src/library/pdf-import/publication`                                 |
| Read                  | Canonical reader v3 projects exact text/structures/resources; marks, resume, translations and offline bytes stay paired to fixed content.                                                                       | `apps/api/src/reader`, `apps/web/features/reader`                             |

Uploads send the browser filename in the optional UTF-8 `originalFilename` multipart text field.
The API validates it before capturing source identity; this avoids Latin-1 multipart header decoding
corrupting Cyrillic names. Older clients omitting it retain the parser-provided filename. File bytes
are unchanged, and existing import records are not rewritten.

Whole-source reconstruction stores complete page observations in private, hash-verified scratch
checkpoints, using at most two decoded page observations within the same32MiB serialized cache bound, plus scalar cross-page evidence as needed. Checkpoints
are limited to32MiB per page,1GiB total and500 pages, within the existing sandbox scratch limit.
Repeated reads verify byte identity even when the parsed page is cached. This bounds glyph retention
without dropping pages, changing text or relaxing source/coverage checks. Scratch observations are
not accepted reader content or durable operator investigation records.

Worker contracts and API types are generated from the locked Python package. Unknown fields,
stale source/task hashes, invented nodes/styles, missing text/resources or unresolved required
structure fail closed. Recognition prompts 13/14 require each decimal, alphabetic or Roman ordered
item's observed ordinal, exact printed marker and depth; unreadable essential markers are unresolved.
Historical prompt bytes remain fixed. Gemini's supported generation grammar describes these rules;
the canonical schema and worker enforce them because the provider grammar cannot express all
kind-dependent conditions. Malformed responses fail with retained investigation evidence.
Text ranges use canonical code-point offsets with explicit UTF-16 browser mapping; surrogate splits
are refused. Image bytes have validated media type, dimensions and hashes.
Generated EPUB projection `ava-epub-canonical-2.2` preserves declared printed page labels in
the page list and pagebreak accessibility names. Targets retain physical page IDs, so Roman numerals
and restarted numbering cannot collide. Missing or blank labels use the physical page number for
navigation without changing canonical source data. Unlabelled books retain the exact `2.1` projection;
both declared versions are accepted only after complete visible-projection/resource comparison.
Changing a profile marker cannot hide altered text, styles, links or page labels.

Generated-EPUB reimport fills empty Library metadata from all accepted portable title/author claims,
including a choice made by the original reader. Candidate claims remain excluded, conflicting titles
are not guessed, and edits or explicit clears on the newly imported entry remain protected. Original
claim provenance and finished canonical content are unchanged. PDF extraction continues to use only
source-origin claims for automatic metadata filling.

Ordinary EPUB ingestion shares the finite generated semantic profile: exact source-path/fragment
addresses and mapped normalized offsets, nested lists and simple tables, semantic notes with
separate return actions, image/caption/credit links, supported typography and literal whitespace.
Missing required images, unsupported list flow and structured table cells produce typed
source-linked blocking findings. A failed entry exposes a minimal preparation error; its private
finding retains the exact resource/tree location for investigation. Broader publisher CSS is
excluded. These importer repairs preserve existing flat-list/translation identities and do not
replace accepted content.

Printed title/copyright evidence may confirm metadata; body headings, quoted labels and unsupported
PDF Info claims remain candidates. A print ISBN is not the generated EPUB identifier.

Book-level refinement compares bounded common-scale source crops and an ordered catalogue. Tasks
are bound to source, observations, images and exact IDs; they can propose heading/parent/chapter,
sparse observed styles and allowed paragraph joins. Refinement task/response/prompt version 2 also
resolves native same-font role candidates selected from isolated numbered openings and conventional
front/back labels. Selection is not proof: decisions distinguish heading, list item and prose;
whole-book ancestry is validated afterward. Native text, spans and measured styles stay fixed.
Source outline/Contents corroboration avoids unnecessary role calls; compact observed lists and
entries under native Notes headings retain their established roles. Whitespace-only source rows
are accounted as layout regions, not empty reading paragraphs, and cannot hide heading gaps.
Native-only text still undergoes structure qualification; already-qualified structure has no model
requests. A native-only configured route refuses required unresolved comparisons before dispatch.
True paragraph joins must have compatible effective typography; sparse unknowns never silently
replace known native properties. They never replace accepted page text. Groups
are bounded (256 catalogue nodes, 32 groups, 24 decisions/16 joins/48 crops per task, 2048×2048
sheet, 4 MiB image). Oversized indivisible context is refused, not silently truncated.

## PDF annotations

The policy also checks linked popup/parent/reply annotation objects under traversal bounds. Worker
preflight includes appearance XObjects and masks in its raster limits; a required appearance cannot
be skipped as blank. Personal relationships are excluded from the private rendering view and
counted in sanitized findings. Rendering-cache receipts are written atomically.

Admission and v2 preparation share a passive-annotation policy. Empty FreeText artifacts need no
recognition. A visible annotation appearance forces recognition on its page, with required source
regions bound into task evidence; an omitted text-box region is rejected. Text must be localized
to its box; page-sized prose cannot substitute for missing editorial text. Non-text appearance
coverage currently requires a localized source-pixel figure. Ordinary overlapping prose is not
appearance preservation. Finite native and scanned Highlight, Underline and StrikeOut ranges now pass through canonical
styles, EPUB CSS and the reader; scoped authored checks and normal native Highlight/scanned
Underline app evidence exist. Exact RGB/DeviceGray source colors require pixel corroboration.
Independent word geometry localizes scan ranges and preserves source-derived image DPI. Full
annotation appearance and supplied-book qualification remain open; an image asset alone does
not establish inline style preservation. Unaffected native prose
remains authoritative. Sticky-note text/popups stay in the original PDF and produce content-free
information findings; they are excluded from author prose and are not migrated into AVA marks.
A private rendering view retains page geometry and verified visible appearances, with source/policy/
output hashes controlling cache reuse. Redactions, clipped/hidden or unrenderable essential
appearances are explicit failures. Legacy native export cannot silently bypass v2 handling.
Current authored render/routing/assembly checks do not establish live OCR or AVA reader qualification.

## Native visibility and language routing

Native trust still requires source geometry and visible-ink checks. A single untransformed rectangular
clip can retain native trust only when it strictly encloses every observed glyph. Only explicitly
inert Normal/opacity-one graphics states pass without review. Offset crops, rotated pages, Form
clipping, compound/partial clips, masks, transfer functions and unknown graphics states retain
review. This is a qualified no-op detection, not permission to ignore clipping or hidden text.

Ukrainian routing evidence combines script proportions, distinctive letters, whole-word hints and
conflicting characters. It does not normalize source text, trust the PDF language tag, certify book
language by itself. The opt-in `ava-pdf-prose-en-uk-v3` profile uses that evidence for routing, then
requires accepted book language and explicit passage language tags before packaging. Conflicting
PDF language metadata remains a conflict; unknown passages are explicit. The legacy English profile
retains its behavior and canonical serialization. API preparation, recognition and reconstruction
must agree on the captured profile before any paid dispatch. Authored native fixtures verify text,
columns, chapter XHTML, TOC, language tags and portable reimport; this is component evidence, not
normal supplied-book or production qualification.

## Reader behavior and failures

Processing, review waiting, Ready and terminal Failed are distinct. Display measured stages, not
invented percentages or ETAs. After durable save the original PDF is downloadable, including while
processing or Failed; generated EPUB and Read require their final gates. Formats and Keep offline
are separate controls. Failed stays visible with a stable safe reference, durable investigation
marker and notification intent. No reader Retry/Cancel or silent reopening is provided.

Contents, note and internal-link jumps resolve exact targets, including cold-loaded chapters and
shared notes. Return uses the initiating reference; session-local Back records successful origins
and restores the exact passage. Failed, superseded and no-op jumps add no history. Reflow/font
changes preserve the landed passage; ordinary page turns, resume and browser Back remain separate.
Hidden measurement copies are inert and carry no duplicate canonical IDs or navigable links.
Contents exposes retained source pages separately from reflowed screen pages. A source-page action
lands on the first canonical block associated with that physical page; it does not invent an
intra-paragraph page boundary. Repeated printed labels retain distinct physical page numbers;
pages without a readable target are unavailable.

Canonical paragraph indents preserve qualified source values, including explicit zero and negative
values. Unknown indentation remains unknown in the fixed content; its neutral reader presentation
does not claim that the original print was flush. Ordinary legacy EPUB presentation keeps its
existing fallback. Illustration transport failures retain readable text and caption association,
show an unavailable-image state and allow authenticated retry of the same immutable resource.
Invalid ownership, length or hash still fails verification. Missing resources prevent a newly
complete offline save; retry does not reconvert or replace the finished book. These candidate
repairs require the recorded normal-app, layout and device checks before release qualification.

Reader Download opens a format panel using the same owned-download path as Library. Converted
books offer the accepted EPUB and Original PDF; ordinary EPUBs offer their stored source EPUB.
The authenticated `GET /api/library/:libraryItemId/formats/:format` endpoint checks active ownership,
stored-file integrity and accepted-publication authority; candidates and internal reader packages
are never downloadable formats. Closing the panel or switching account/book aborts pending client
work. Unavailable downloads show a retryable download error, separate from terminal conversion
failure. Keyboard dismissal returns to the visible initiating control after responsive reflow.
Text-size steps include the existing endpoints and default, so reversing either endpoint can return
to 100%; older saved intermediate preferences remain readable.

Search uses the complete fixed canonical text graph, including notes, captions, list items and table
cells, without OCR/LLM calls. Literal Unicode case matching preserves source UTF-16 target offsets.
Results carry chapter labels and bounded excerpts; selecting one uses the same exact jump and Back
path. Legacy EPUBs load checked chapter adjacency and fail visibly if whole-book content is unavailable.
Partial search must not report a complete no-match result. Queries/results and corpus sizes are bounded;
no derived search index is written into accepted content. Physical-device/offline and independent
review qualification remain separate from source implementation and unit checks.

Owned generated-EPUB reimport uses ordinary Library upload, isolated validation and a new immutable
owned identity. Foreign final-content IDs/resource URLs cannot become authority. Existing EPUB
imports keep their ordinary route; ZIP64 and split archives are explicitly refused by upload
preflight. Legacy chapter-label maintenance excludes canonical PDF/EPUB Books at selection and swap.

Deleting an entry revokes access and fences active work. Minimal billing/terminal receipts may
outlive private document data; unknown paid exposure is retained until authoritative reconciliation.
Physical cleanup/backup policy is a separate operating decision; production purge is disabled.

See [operator setup](pdf-conversion-operations.md), [verification and current limitations](pdf-conversion-verification.md)
and the [worker package](../packages/pdf-epub/README.md). No production provider route, reader
qualification or cleanup activation is implied by installing or merging the implementation.

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
unmarked text. Explicit RGB colors and continuous strokes are checked against rendered source pixels;
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
Partial words, duplicate matches and inconsistent text require review. A packaged true-scan fixture
and authored transcription oracle establish scoped reconstruction/reimport evidence, not live VLM
transcription quality or general scanned-book support. Wider appearance/color cases remain unfinished.

This is source mapping and finite transport, not full product qualification. Actual normal reader
flows at dark/light themes and large text, live annotation OCR and independent review remain required
before declaring annotation conversion supported. Source-pixel crops alone are not the final
inline-style representation.

The bilingual annotation localization change requires a newly built worker image and actual
scanned Ukrainian fixtures before installed support is claimed. The earlier native profile image
does not contain Ukrainian traineddata. Package version: [Debian Ukrainian OCR data](https://packages.debian.org/bookworm/tesseract-ocr-ukr);
fixed multiple-language invocation follows [Tesseract CLI documentation](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html).

Native literal candidates retain isolated, indented printed line groups before paragraph joining.
The source-bound role decision distinguishes verse, quotation and ordinary prose without replacement
text or typography. Verse/quotation keeps the printed breaks; prose unwraps only layout separators,
with unchanged native glyph/span offsets and retained source lines. Geometry alone does not establish
poetry, and an unconfirmed group cannot become an accepted candidate. This is an isolated implementation
under qualification; full supplied-book, scanned and actual reader fidelity remain open.

Refinement v3 expresses native-role and OCR-typography decisions as mutually exclusive wire forms.
A native decision has an explicit role and null style; an OCR decision has null role and a required
observed style object. The lowered provider grammar preserves these constraints. Task/source/crop
identity, observed native typography, complete decision coverage and relationship/join checks remain
separate semantic gates. A refused, settled response is retained and stops further dispatch.

Structure requests include exact required source crop IDs for each node and join. The converter
rejects a response that cites another node's reference, even when its visual decision is plausible.
Accepted source-bound responses can be reused during investigation without new provider calls;
failed Library imports are not reopened or changed to Ready by diagnostic replays.

### Native compound-word layout joins

After source-bound refinement, ordinary native prose may remove the proven layout separator between
letter-hyphen and letter. The printed hyphen remains. The normalization map accounts for the exact
deleted whitespace, and span/link/target/alias offsets move together before graph assembly. Inline
spaces, OCR text and literal verse/code/quotes are not rewritten. Confirmed native page/column joins
use the actual separator length. This is layout recovery, not spelling correction or dehyphenation.

### Source-bound PDF navigation

Link annotations preserve ordinary URI and direct/named GoTo destinations. A narrowly recognized
literal `this.zoom=100;this.pageNum=N` link is interpreted as a source-page target; no JavaScript is
executed. Other scripts, chained actions and additional actions remain refused. Bare `www.` hosts
use an explicit HTTPS export policy with an information finding; original source bytes stay fixed.
Native link rectangles map to exact visible glyph offsets. Visually recognized text can also use
native geometry when it exactly corroborates one visible source line in a uniquely owned source
region. Only line-edge layout whitespace is excluded from this comparison, with offsets accounted
for; letters, internal whitespace and accepted text stay unchanged. Unreliable glyph mappings,
clipped glyphs, optional-content and complex-state observations cannot qualify this alternative.
The text remains an OCR segment and still requires its dispatched recognition receipt. A content-free
information finding records corroborated geometry; native geometry cannot authorize transcription.
Other scanned link rectangles use bounded local word OCR, cached per linked page, with exact
transcription alignment and unique geometry ownership.
Low-confidence, clipped, hidden or ambiguous words require review. Scanned table-cell links and
coordinate destinations without native line anchors remain unqualified. Admission and unit-test
coverage do not establish supplied-book reconstruction, typography or normal-reader qualification.

### Recognition response interoperability

The API canonicalizes complete six-digit hex colours in observed style properties to lowercase.
It does not change source text, offsets, identities, malformed colours or unknown fields.
Recognition URL spans reuse the strict annotation policy for printed bare `www.` addresses,
adding HTTPS only for a valid credential-free hostname. Explicit schemes remain unchanged;
unsafe destinations and unresolved source mapping still fail validation.

Standalone printed web addresses with URL-only spans use exact text positions computed by the
host. No approximate match or arbitrary span clamp is permitted; styled/reference spans and
ambiguous labels retain strict validation. Linked running text is retained as a credit before
furniture removal, with an informational finding; its original source instance/text stays intact.
Native font rectangles include ascenders/descenders and layout spaces. Corroborated visual text
may use a quarter-source-font-size allowance around its ink box, measured against non-space
glyphs; source/model boxes remain unchanged. Exact text, unique ownership, visibility and the
PDF link rectangle's complete glyph coverage remain required. Local OCR confidence stays85.

Uncorroborated OCR major headings without an outline retain blocking hierarchy findings and
reach source-backed whole-book review preparation. Preparation does not establish a chapter rank
or publication eligibility. Existing source findings remain recorded. A link span with an identical
source URL/range keeps its independent observed style; destination or range conflicts still fail.

### Repeated OCR running headers

Before whole-book refinement, the worker may reconcile inconsistent OCR heading/furniture roles
only for exact repeated marginal text: at least three distinct pages and half the book, matching
position within one percent, and an observed furniture peer. Linked text and declared chapters are
protected; duplicates and displaced/body matches remain unchanged. Original words/styles/IDs remain
unchanged and every removed reading-stream region remains recorded as furniture with an informational
finding. This bounded rule does not qualify other repeated titles or substitute for final source QA.

### Source-owned literal address links

A PDF annotation and visible glyph/word geometry may establish full coverage of an exact standalone
printed URL even when a model URL span ends early. The worker keeps the observed style range intact
as a separate style span and adds the source-proven link range; it never extends typography to repair
a link. The strict literal address must match the source destination, with unique exact text ownership
and no ambiguous link/note targets. Different destinations, ordinary labels and unproven geometry
remain failures. This source-derived action is recorded separately from observed typography.

### Source font roles for OCR

After whole-book review, uniform visible source fonts may corroborate OCR family/bold/italic.
The same non-whitespace characters/order, bounded ink geometry, unique segment ownership and
visible glyphs are required. Scan-image overlap, unsafe rendering, unreliable mapping and unknown fonts prevent corroboration. Text authority, literal text, offsets, boxes and other
style attributes are unchanged. The informational report finding records this typography decision;
it does not establish exact print metrics or synthetic stroke weight. Mixed fonts can additionally corroborate exact Unicode inline runs inside a fully visible source
region, including explicit plain resets at connectors/punctuation. The region must have a proven
coordinate mapping and enclosing single axis-aligned clip under finite scale/translation/reflection;
this opt-in proof does not relax whole-page native routing. Existing links/ranges and non-font styles
stay unchanged; the new spans own only family/bold/italic. Whitespace bridges matching faces or stays
plain. Unknown/ambiguous/concealed observations remain unqualified.

Type3 fonts qualify only in a finite uncolored-outline subset: known descriptor roles consistent
with italic flags, a Unicode map, bounded diagonal matrix/widths/character procedures and initial d1
metrics followed solely by numeric path construction and fills. Images/forms/nested text/colors/
clipping/transforms/graphics states/arbitrary paint are excluded. Each resulting segment still needs
region visibility, exact OCR text and unique ownership. Font declarations are corroborating evidence,
not a claim of exact licensed typeface reproduction or mathematical proof of style. No source fonts
are embedded. The four-page installed
response replay and separate AVA EPUB rendering check pass locally; independent review and the
complete supplied-book/device qualification remain open.

### Verification session deadlines and cover evidence

A test harness must outlast the production job deadline plus shutdown/evidence collection. A
25-minute local expiry interrupted a 30-minute job after page extraction; operator_stop is distinct
from RESOURCE_LIMIT. Retain the original attempt and settled costs. Terminal stopped imports are
not reader retries and must not be rewritten as successful. Fresh QA imports carry cumulative
per-model spending forward; production sandbox/deadline limits remain enforced.

The candidate cover extractor preserves original rendered pixels separately from OCR title text
when first-page accepted title evidence and a unique large cover bitmap corroborate frontmatter.
Ambiguous/small/body artwork is not auto-classified as a cover. Asset extraction tests do not prove
normal PDF publication cover binding, reader rendering, or complete supplied-book source fidelity;
those checks remain pending.

Cover integration follow-up: source artwork uses one explicit first-page cover layer, independent
of ordered text bands. Updated generated contracts must be deployed/qualified together. A hashed
validator-owned publication report projects the cover resource ID; first publication binds only
its accepted owned image into a private PDF book without an existing cover. Authenticated cover
routes and the existing per-account cover cache retain deletion/ownership checks. Normal PDF reader
cover display is still unqualified. The page checkpoint cache now retains at most two observations
within32MiB serialized bytes, while rechecking each file hash even on hits. An offline900s replay
expired during reconstruction; do not report its exit137 as OOM without memory-limit evidence.

### Reconstruction resource measurements

The 126-page saved-response cover candidate completes offline in 1310.294 seconds under
2 GiB/no-swap/one CPU. EPUBCheck passes with the production 512 MiB JVM heap bound; an ad-hoc
unbounded-heap invocation reported a corrupt image and timed out, while the unchanged EPUB passes
both heap-bounded controls. Keep diagnostic configuration distinct from runtime results.

Native style runs are grouped before normal validated span allocation. Geometry-only consumers
use bounded validated scalar projections, with fresh checkpoint snapshot/hash checks on access.
These reduce repeated allocations/decoding without relaxing source text/style/coverage checks.
The frozen126-page replay completes in794.274 seconds versus1310.294 seconds (39.4% reduction).
The full canonical JSON, EPUB and cover bytes match the baseline exactly. This measured installed
result is separate from normal import/reader and five-book qualification, which remain open.

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

Recognition generation grammar requires an explicit chapter flag on every segment. This prevents
non-chapter headings from omitting the kind-required observation when the provider grammar drops
conditional allOf branches. The authoritative JSON Schema/Python validator still rejects missing
or inconsistent observations; the host neither inserts a guessed flag nor repairs stored output.
A failed same-source import remains terminal and duplicate-protected. Test a corrected build in a
fresh isolated database, with existing settled costs and unresolved exposure carried forward.

The opt-in English/Ukrainian pipeline now keeps reliable native content when language uncertainty
is its only finding. Supported primary language is still established by the whole-book validator;
unknown passage language staysund. Other source risks retain recognition. This source candidate
has authored regression evidence but awaits installed/full-book qualification; it is not a
production activation or a repair/reconversion of existing failed entries.
