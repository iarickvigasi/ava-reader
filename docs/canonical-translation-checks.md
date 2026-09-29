# Canonical translation checks

> PDF-11 / PDF-03 reimport identity · 2026-09-29 · Candidate, not publication qualification

From the integration checkout root, with providers mocked or absent:

```sh
pnpm --filter api exec jest --runInBand --testPathPatterns='/(book-translations|reader/canonical)/'
pnpm --filter web exec vitest run features/reader/bilingual features/offline/buckets/translations components/app/reader/bilingual components/app/reader/selection
pnpm --filter api exec eslint src/reader/canonical src/book-translations
```

[Reader checks](pdf-reader-checks.md) own schema/build generation and the general reader fixtures.
Use CUA at `/dev/canonical-bilingual-fixture` to inspect authored `Test ·` text in real ReaderScreen.
It seeds only fixture cache IDs and includes no real model output or publication authority.
Check partial tables/header context, nested markers, code, source selection, a shared cold note,
Return, TOC Back and font/viewport reflow. Actual target text must be visible, not merely focused.

PDF and imported-EPUB catalogs share exact accepted canonical text/UTF-16 coordinates. Their
server authority remains distinct: PDF operation/publication versus an owned EPUB import and
source/reader hashes. Both recheck acceptance/qualification before and after locked writes.
Neither an imported sidecar nor the browser can confer publication authority.

The original workspace `output/pdf-epub-integration-11/` retains source checks, review findings,
CUA observations and database probes as separately labelled evidence. The direct-service database
probe requires an explicitly reserved synthetic Ready fixture in a disposable database and denies
all provider calls. It must not run against an application account or stop unrelated jobs.

Repeat on a real accepted owned book with server-saved translations, normal authentication,
offline re-entry and account/deletion boundaries before declaring qualification. A fixture or a
source fingerprint does not establish model quality, physical-device selection or accessibility.
Production registration remains separately gated by evidence for the exact reader and adapter.
