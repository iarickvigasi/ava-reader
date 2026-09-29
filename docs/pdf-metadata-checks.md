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
