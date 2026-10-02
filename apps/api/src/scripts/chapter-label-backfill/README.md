# Temporary EPUB chapter-label backfill

Run from the repository root in the production API environment with `DATABASE_URL` supplied by
its normal secret configuration. No URL fallback and no automatic `.env` loading. Deploy the
updated EPUB parser first so new imports use the same names. Run during maintenance with reader
processing/analysis workers paused to prevent a pending analysis from restoring an old index.

```sh
pnpm --filter api db:backfill-epub-chapter-labels --dry-run > chapter-label-preview.jsonl
pnpm --filter api db:backfill-epub-chapter-labels --apply > chapter-label-applied.jsonl
```

The default is dry-run. Review the preview first; it includes book/file IDs and before/after labels.
The script scans READY primary reader files of EPUB books held by any user's library, including
archived items. Shared catalog books are processed once, regardless of how many users hold them.
Books without a READY package, PDFs, and unused historical packages are excluded.
Owned PDF conversions and generated EPUB reimports are excluded by their permanent Book markers,
both during selection and the final file swap. Their accepted canonical content is immutable;
this legacy label repair must not reinterpret or replace it.

Labels matching `Chapter <spineIndex + 1>` or the exact excerpt regenerated from the stored blocks
are eligible, as are names matching a component of a combined opening heading. Combine semantic
and short enlarged centered paragraph headings with `/`; retain the authored number. Image-only
part dividers may use the next textual opening without changing chapter boundaries. No body text gives a number-only fallback. These old formats have no provenance
marker, so an authored title with exactly the same wording is indistinguishable and also eligible.
Complete authored names remain. Titles and matching nested TOC labels are patched alongside the stored
progress index, preserving analysis counts. Content, IDs, source checksums, progress positions,
translations, annotations, and reading statistics are unchanged. Historical saved progress labels
refresh on the next progress write.

One package is loaded at a time; metadata is paged in groups of 25. Invalid packages/indexes or
concurrent file changes are reported to stderr and cause a nonzero final exit. Other books continue.
Reruns skip updated packages. Keep the output report: successful writes include rollback IDs.

Each update writes a new immutable blob and atomically swaps the existing primary file's blob and
index. This bypasses the API's blob-ID cache without invalidating analysis file identity. A
non-primary backup BookFile retains the old blob and index, protecting it from orphan cleanup.
A failed transaction may leave a new orphan blob for the existing sweeper.

Rollback during maintenance: for each applied report entry, verify the primary file still points
to `newBlobId`, then restore its `blobId` and `readingProgressIndex` from `backupFileId` in one
transaction. Keep the same primary file ID. Do not restore over later reprocessing. Backups may be
removed after rollout verification; they consume storage until explicitly cleaned up.

This script changes server packages only. Deploy the web app's `DownloadedChapterLabelMigration`
runner as well: on authenticated startup, reconnect, or tab return it fetches server labels and
patches legacy names, encoded XML/numeric references, and numbered excerpts with cached opening
headings, partial opening names, and number-only image dividers without a full-book download. Excerpt repairs require the same TOC node and target. The reader
response includes a chapter window, which the migration discards. Offline devices update after
they load this app version and reconnect; already-open readers see the names
on their next cached load. No user database or pending mutation is cleared.
