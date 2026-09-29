# PDF display metadata checks

PDF-10 candidate implementation, 2026-09-29. Editing title, authors and language changes AVA's
display envelope; accepted canonical content, EPUB/source bytes and locators stay fixed.

The owned GET metadata endpoint returns values and `metadataEditVersion` under the item lock.
PATCH requires that version, increments it and marks edited fields as user-authored. Extraction
may fill empty untouched fields only; a successful nonempty fill also advances the version.
That internal handoff requires the current worker attempt and a live lease inside the queue/item
transaction. A final authority check rolls back claims and fills if authority expires during work.

The online-only Edit details dialog loads one authoritative snapshot before enabling fields.
A conflict or ambiguous transport result retains the draft, disables Save and offers explicit
Reload saved details. No edit is queued offline. Account changes and deletion fence local writes.
Library/card/details merge rules preserve known newer display metadata against stale responses;
a late book download overlays current display fields while retaining immutable canonical bytes.
Continue reading also overlays newer cached metadata when an older Home response arrives.

```sh
pnpm --filter api exec jest --runInBand --testPathPatterns=src/library/pdf-import/metadata/
pnpm --filter web exec vitest run features/offline/buckets/library features/offline/buckets/book lib/api-types/pdf-metadata.test.ts
pnpm --filter api typecheck
pnpm --filter web typecheck
```

Actual authenticated UI verification remains required: open details, edit, save, reload, simulate
a concurrent edit and confirm draft retention/Reload, go offline, switch account and delete during
a delayed response. Source tests and fake IndexedDB are not that product-flow evidence.
Retained initial/final logs live in the original workspace `output/pdf-epub-integration-10/`.

Printed metadata is confirmed only within supported bibliographic context: an opening centered, nonchapter title
before the body, a copyright/publication-details section before the body, or an
explicit backmatter colophon. A section heading or frontmatter chapter role alone cannot become the book title. Labelled
body paragraphs remain source candidates; quoted or embedded narrative labels are not extracted.
PDF Info text appearing in the body does not corroborate title, author or subject. Ambiguous
layouts remain unconfirmed; this conservative scope does not identify every real copyright page.

The supplemental fixture's “Source claims” block is inside body chapter 2. Its edition, date and
ISBN strings are preserved as candidates. Earlier tests incorrectly treated their presence as
bibliographic confirmation. The original independent source oracle and PDF remain unchanged;
this correction changes authority, not source text. Genuine title, subtitle and copyright-page
controls still confirm their fields. Thirteen focused metadata/source reconstruction tests pass;
the combined worker snapshot passes 260 tests, including the separate refinement-style repair.
These checks do not establish arbitrary-book metadata fidelity or an updated deployed image.
