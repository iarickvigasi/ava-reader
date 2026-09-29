# PDF content boundary checks

PDF-03 builds on the [worker foundation](pdf-worker-checks.md) and [ADR8](adr/8-canonical-content-adapter.md).
The canonical adapter is now connected to [ordinary generated EPUB import](adr/13-canonical-epub-import.md).
PDF publication and reader delivery retain their separate qualification gates.

Code: `apps/api/src/pdf-conversion/content/` and `packages/pdf-epub/src/ava_pdf_epub/epub_v2/`.
The independent synthetic canonical oracle and real PNG are under `packages/pdf-epub/tests/epub_v2/fixtures/`.

```sh
pnpm --filter api exec jest --runInBand pdf-conversion/content reader/epub
pnpm --filter api typecheck
pnpm --filter api lint
# From packages/pdf-epub with its pinned environment:
PYTHONPATH=src python -m unittest discover -s tests -v
ruff check src/ava_pdf_epub/epub_v2 tests/epub_v2
mypy src/ava_pdf_epub/epub_v2
```

`prepareReaderPackage` requires canonical bytes and server-provided final/source/canonical identity;
the canonical digest must come from Python `document_digest`, not JSON.stringify. It returns reader
v3 plus conservation/counting projections. The reader remains an unpublished candidate.

`importGeneratedEpub` requires the bounded `pythonEpubReimport` bridge, semantic validator and client
version/capabilities. The bridge uses a trusted installed interpreter and fixed `-I -m
ava_pdf_epub.epub_v2`; it accepts EPUB bytes, not caller-provided file paths. It never fetches assets.
`resolveAddress` requires both source resource path and fragment and returns exact UTF-16 identity.

Evidence in the originating workspace's `output/pdf-epub-integration-03-05/` distinguishes Python/API
logic, installed-wheel protocol, authored EPUB semantics, EPUBCheck and actual product behavior.
Tests retain malformed metadata, corrupted raster, changed XML/CSS/nav/assets, ZIP bounds/traversal,
duplicate entries, Unicode/CR text and capability/identity refusal cases. Existing EPUB tests remain.

Ordinary `/library/import` detects declared generated EPUBs without host content inflation, then
queues a separate owned preparation run. The fixed container validates the portable graph and exact
projection, runs EPUBCheck and streams hash-checked reader/resources. A new content ID prevents
imported publication claims becoming authority; immutable retained content waits for qualification.
The source, cover and reader remain separately authorized. Malformed declared content never takes
the ordinary parser fallback. ZIP64 and split ordinary archives are an explicit compatibility limit.

Evidence in `output/pdf-epub-integration-03-reimport/` includes actual rich/two-column imports,
lease recovery, stale-authority refusal, ownership, corruption, cover and deletion checks. The
212-test worker snapshot and independent reviews include repaired initial failures. All activation
there used TEST qualifications. PDF-03 AC06 now has implementation and scoped runtime evidence;
normal authenticated generated/ordinary EPUB reader flows remain required by PDF-04/13. No sidecar,
package-valid EPUB or adapter result alone closes those product qualification gates.
