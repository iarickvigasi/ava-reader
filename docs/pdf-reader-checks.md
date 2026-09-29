# PDF reader implementation checks

> PDF-04 / related PDF-11 · 2026-09-29 · Candidate, not publication qualification

Run from the integration checkout root. No provider calls or production database are needed:

```sh
pnpm --filter api exec jest --runInBand --testPathPatterns=/reader/
pnpm --filter web exec vitest run features/reader components/app/reader features/offline/buckets/book
pnpm --filter web exec tsc --noEmit --incremental false
pnpm --filter web exec eslint features/reader components/app/reader features/offline/buckets/book
node apps/api/scripts/generate-pdf-contracts.cjs --check
```

Use the locked Python environment and current `packages/pdf-epub/src`, not an older editable install:

```sh
PYTHONPATH=packages/pdf-epub/src python apps/web/scripts/generate-canonical-fixtures.py
```

After all production web changes freeze, produce and inspect the source manifest:

```sh
node apps/web/scripts/generate-reader-fingerprint.mjs --manifest /private/tmp/reader-source.json
node apps/web/scripts/generate-reader-fingerprint.mjs --check
```

The fingerprint covers production web source/styles/assets and the dependency lock. It excludes
tests/dev fixtures, generated build constant, build output and installed dependencies. It is source
identity compiled into `X-AVA-Reader-Build`, not an approval to publish. A later source change
requires regeneration and evidence review; actual accepted reader qualification remains separate.

For browser checks, run the existing web dev setup and open `/dev/canonical-reader-fixture` through
CUA. Production returns 404. The route uses real reader components in a viewport-locked fixture
shell, with a synthetic four-chapter graph, exact text and real PNG. It has no imported library row.
Exercise both shared callers, a cold target, A→B→C→Back B→Back A, TOC and failed/no-op targets,
font/theme/reflow, table/list selection and saved offline account isolation. Do not treat DOM focus
alone as a visible-navigation pass: inspect the actual target text inside the page viewport.

Evidence in the original workspace `output/pdf-epub-integration-04/` retains initial failures,
subsequent fixes and source tests. Root CUA evidence lives under `output/pdf-epub-integration-10/`.
The initial cold-note target was focused but clipped by cross-chapter prefix geometry; standalone
canonical spreads repaired it. Authored fixture success is not PDF reconstruction or production
authenticated-reader evidence. Full import/publication, actual annotations, device selection,
translations, capacity and accessibility remain required qualification obligations.

The accepted-PDF API route now forwards `X-AVA-Reader-Schema` and `X-AVA-Reader-Build` to the
registered qualification check. Configure `AVA_PDF_CONTRACT_PYTHON` to the absolute installed
worker interpreter; API validation is limited to two concurrent JSON checks per process and
returns a safe 503 when unavailable. Ordinary EPUB delivery does not require that setting.
PDF progress saves validate canonical block/table-cell addresses and exact UTF-16 boundaries,
then recheck publication ownership, qualification and immutable identity under the item lock.
Older offline reads cannot overwrite later stored positions. These endpoints are wired but
remain gated by the empty production qualification catalog; tests do not activate publication.

Canonical bilingual and separate generated-EPUB identity checks are documented in
[canonical translation checks](canonical-translation-checks.md). Authored fixture observations
remain distinct from accepted owned-reader and database persistence evidence.
