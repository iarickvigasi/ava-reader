# Chapter Purpose Analysis

> Status: active · Updated: 2026-08-11 · ADRs: [[2-openrouter-and-byo-key]] · Code:
> apps/api/src/book-analysis

## Summary
Labels every chapter of a book with what it is for — body text, notes, contents, references — so
reading-time and progress estimates count only the prose a reader actually reads. The first member
of a general book-analysis pipeline.

## Scope
- In: the `chapter-purpose-v1` pipeline (sampling, prompt, structured output), `BookAnalysis`
  storage, body-only reading time and completion percent.
- Non-goals: any other analysis kind, surfacing labels in the reader UI or TOC, per-user or
  per-language analysis, re-running on prompt changes automatically.

## Behaviour
1. The first read of a book enqueues a `BookProcessingRun{ pipeline: 'chapter-purpose-v1' }`. The
   reader payload is served immediately — analysis never blocks a read.
2. `BookAnalysisService` polls (2s), claims a run, and builds one **digest** per chapter locally:
   normalised title, structural signals, and ~160 sampled words (100 from the start, 60 from the
   midpoint). No AI is used to build a digest.
3. All digests go out in **one** `generateObject` call, chunked at 60 chapters with every chapter's
   title repeated in each chunk so cross-chapter context survives batching.
4. Each chapter comes back as a purpose plus `high`/`low` confidence, keyed by its numeric index
   rather than its chapterId — ids are href-derived slugs (`part0008-split-002`) that cost real
   tokens across a book and would smuggle the source filename back into the prompt. The result is
   stored, the `readingProgressIndex` is patched, and `Book.estimatedBodyPageCount` is recomputed.
5. Reading time and completion percent then count only chapters whose purpose counts (below).

Analysis is book-scoped, not user-scoped: a catalog title read by many users is analysed once.

## Labels & policy
`BODY` `FRONT_MATTER` `TOC` `PREFACE` `AFTERWORD` `APPENDIX` `NOTES` `REFERENCES` `INDEX`
`GLOSSARY` `PROMOTIONAL` `UNKNOWN` — a Zod enum in `chapter-purpose/schema.ts`, not a Prisma enum:
the result is a JSON column, the enum already has to constrain the model's structured output, and
adding a label later needs no migration.

The model reports **what a chapter is**; whether it counts is a pure function in
`chapter-purpose/policy.ts`. Counting today: `BODY`, `PREFACE`, `AFTERWORD`, `UNKNOWN`, plus any
`low`-confidence chapter. Over-counting degrades to the old whole-book behaviour; under-counting
invents a wrong number, so the defaults lean toward counting.

## Sampling
Titles are untrusted input. `resolveChapterFallbackLabel` fabricates `Chapter <n>` when a book has
no usable TOC, so a bibliography can arrive labelled "Chapter 41". `normalize-title.ts` drops any
title equal to `Chapter <spineIndex+1>` (it carries nothing beyond the position already sent as a
signal) and reduces filenames, `Section 0012`, and bare numerals to `(untitled)`. The prompt states
that titles may be absent or machine-generated and must not outweigh the sample.

Signals per chapter, all computed locally: word count, block count, median block length, digit
density, link count, spine position. A bibliography is short blocks plus high digit density; a
contents page is nearly all links; a 40-word chapter is never body text. With no titles at all the
sample plus these signals plus cross-chapter comparison still carry the classification.

## Data & sync
`BookAnalysis` — `@@unique([bookId, kind])`, `status`, `promptVersion`, `schemaVersion`,
`modelId`, `readerFileId`, `attempts`, `result` Json, `errorMessage`. `readerFileId` is the primary
DERIVED_READER file the labels came from: reprocessing always creates a new `BookFile`, so a changed
id means the chapter ids shifted and the labels are stale. It is also free to read on both the read
and failure paths, which a package checksum is not.

`result` = `{ version, chapters: [{ chapterId, purpose, confidence, counted }], lowConfidence }`.
No stored reasoning text — it would cost output tokens on every book and nothing reads it.

`ReadingProgressIndex` v2 adds `counted` per chapter and a `bodyBlocks` total, so progress needs no
extra query. It stores the policy *outcome*, not the purpose: the index is a derived cache and
`BookAnalysis.result` stays the source of truth. A v1 index runs the old math, so nothing needs
backfilling.

**No progress client changes.** The web app only mirrors the server's `completionPercent`
(`buckets/progress/storage.ts`), so no bucket work and no Dexie version bump. The library bucket
caches the new `approximateBodyPageCount` alongside the existing details and defaults it to null on
rows written before this shipped.

## Reading time & progress
`Book.estimatedPageCount` stays the whole book — the honest answer for the "Pages" row.
`estimatedBodyPageCount` (body characters ÷ 1800) is new;
`LibraryBookInfo.approximateBodyPageCount` carries it and `formatReadingTime` prefers it, falling
back to the total when null.

`computeProgressMetricsFromIndex` divides by body blocks only and clamps: a locator before the first
body chapter reads 0%, after the last reads 100%. That clamp is a real fix — `library.service.ts`
and `home.service.ts` filter "currently reading" on `completionPercent < 100`, so a novel with a
heavy bibliography could never leave that shelf.

## Edge cases
- Missing API key, AI error, or schema violation → run `FAILED` with the message; labels stay
  absent and the fallback math runs. Nothing user-facing breaks.
- Re-enqueue is skipped once `attempts` reaches 3 for the current `readerFileId` — without the cap
  an unparseable book burns credits on every open. The counter resets when that file changes, so a
  re-imported book gets a fresh set of retries.
- The AI call is capped at 90s. The poller's in-flight guard clears only in a `finally`, so one
  request that opens a socket and never answers would otherwise silently stop all later analysis.
- Enqueue is check-then-create, so two simultaneous opens can queue two runs; the worker re-checks
  freshness before spending, making the loser cost one indexed read rather than a second AI call.
- A `PROCESSING` run only blocks re-enqueue for 10 minutes. A process that dies mid-run would
  otherwise leave a row nothing ever closes, and that book could never be analysed again.
- Chapter text is untrusted: samples and titles are stripped of the `"""` fence so an imported book
  cannot close its own quoted block and have its words read as instructions.
- A labelling where no chapter counts is degenerate — progress ignores it and counts the whole
  book rather than pinning the reader at 0%.
- Unknown chapter ids in the response are ignored; omitted chapters default to `BODY`. A chapter
  the stored analysis does not mention counts, via the one `createCountedLookup` that both the
  progress index and the page count read — they must never disagree about the same book.
- Fewer than 2 chapters → skip the call entirely.
- Body under 40% of total words trips the aggregate guard: the analysis is marked `lowConfidence`
  and everything counts.
- Stored `ReadingProgress.completionPercent` rows are not rewritten; a reader keeps their old
  percentage until the next progress write. Recomputing on read would mean loading a progress index
  per book on every library list.

## Acceptance criteria
- [ ] Opening a book with no analysis enqueues exactly one `chapter-purpose-v1` run.
- [ ] A book's notes, contents, and references chapters are excluded from reading time.
- [ ] Reaching the end of the last body chapter reports 100% even with back matter after it.
- [ ] A book whose chapters are all titled `Chapter <n>` is still labelled correctly.
- [ ] A failed or missing analysis produces exactly the pre-analysis estimates.
- [ ] The aggregate guard forces full counting when body falls under 40% of words.
- [ ] A re-imported book (new checksum) is re-analysed rather than reusing stale labels.

## Open questions
Whether `PREFACE` and `APPENDIX` should count is a product call, tunable in `policy.ts` without
re-running any book. Who pays for the call once BYO-key and credits exist (ADR 2) is unresolved —
today it runs on the app's `OPENROUTER_API_KEY`.
