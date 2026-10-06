# Temporary EPUB edge regrouping backfill

This tool changes existing server reader packages; new imports share its grouping rules in
`reader/epub/edge-grouping`. It does not repair heading-only chapters in the middle. It uses source
EPUB semantic types and exact known section
names (English names as fallback); filenames and short length alone never identify a section.
Image-only pages can extend a positively identified opening run. Unknown text boundaries stop
grouping. Multi-segment source documents are left alone.

Consecutive opening pages become **Front matter**. **Contents** is a separate chapter and interrupts
an opening group. Prologues, introductions, and prefaces stop opening grouping. Consecutive semantic
footnote-only documents in the trailing back-matter region become **Footnotes**. Other back
sections remain separate. Every block and its ID stays unchanged and in source order; each group
keeps its first chapter ID. Remaining chapters retain IDs/content but get updated indices and
neighbour links. The authored middle TOC hierarchy is retained. Removed edge entries become one
entry per group. Repeated application is a no-op. Version 2 revisits packages previously processed
by version 1.

```sh
pnpm --filter api db:backfill-epub-edges --dry-run > edge-preview.jsonl
pnpm --filter api db:backfill-epub-edges --dry-run --book-id=BOOK_ID
pnpm --filter api db:backfill-epub-edges --apply --book-id=BOOK_ID > edge-applied.jsonl
```

Supply `DATABASE_URL` explicitly via the normal secret configuration; no `.env` is loaded. Dry-run
is default and performs no writes. It reports exact groups, counts, original hrefs, and blockers.
The scan includes READY primary packages for EPUB books in users' libraries, including archived
items and shared catalog books (once per primary file); historical packages are excluded.

**Apply only during maintenance with reader writes and workers stopped and drained.** The file swap
uses an optimistic concurrency guard; user-reference checks are not a replacement for maintenance.
Take a database backup. The tool refuses source checksum mismatches and malformed locators/indexes.
It reports/skips books with pending processing, offline download intent, saved positions,
annotations, AI comments, or translations referencing removed chapter IDs. It also skips groups
whose progress-counting flags disagree. Blocked applies exit nonzero; other books continue.
Do not delete user data or disable offline intent just to bypass these checks. Those books need a
separate locator/content-cache migration. No force option is provided.

Even without offline intent, readers can hold automatically cached chapters. Before applying,
clients must sync pending changes; afterwards affected client content caches must be refreshed or
removed and re-downloaded without deleting user-data buckets. This script does **not** automate
that rollout. Do not run it against actively used books and assume offline devices will update.

The stored package is regrouped rather than re-parsed into new blocks, preserving exact main-body
content, block IDs, source checksum, and primary reader file identity. Stored user data is not
rewritten. Uniform progress-counting flags and body totals remain unchanged; existing analysis
entries for removed chapters become unused. Existing translation IDs for surviving chapters remain
valid. A new immutable blob bypasses the API package cache; a non-primary backup BookFile protects
the old package and index from garbage collection. The report contains rollback IDs.

Rollback under the same maintenance conditions: confirm the primary file still points to the
reported `newBlobId`, then restore its blob and progress index from `backupFileId` atomically.
Refresh affected client content caches again. Never roll back over subsequent reprocessing.
Failed swaps can leave unreferenced new blobs for the existing orphan sweeper. Keep backup files
until rollout verification is complete. No automatic rollback or production execution is performed.
