# Partial offline reading notice

> Status: active · Updated: 2026-06-10 · ADRs: [[3-offline-first-dexie-buckets]] · Related: [[6-offline-reading]], [[12-offline-save-sync]] · Code: apps/web/components/app/core/partial-book-offline-modal.tsx, apps/web/features/offline/buckets/book/partial-offline.ts, apps/web/features/offline/partial-book-bus.ts

## Summary
When a reader opens a book **offline** that is only partially cached (some chapters from a prior auto-save, not explicitly saved), a modal tells them how many chapters are available and offers **Save offline** — so they know to expect a wall and how to get the whole book. Serves the offline-first job (product.md).

## Scope
- In: detection (offline + cached chapters < total + not explicitly saved); a global modal (reuses the [[6-offline-reading]] modal pattern) with chapter counts, a Save-offline action, and a per-session dismiss.
- Non-goals: changing what auto-save caches; any online behaviour (auto-save is already completing the download); never-opened books (zero chapters → the existing "missing book" modal applies); blocking navigation at the wall.

## Behaviour
1. On reader open, if **offline** AND the book's cached-chapter count `<` its TOC chapter count AND it isn't explicitly saved → emit a `PARTIAL_BOOK` window event (`{libraryItemId, cachedChapterCount, totalChapterCount}`).
2. A modal mounted once in `AppShell` (reader branch, beside the missing-book modal) listens and shows: "N of M chapters available offline" + body explaining the rest downloads when saved.
3. **Save offline** button → `useSaveBook(id).save("explicit")`: offline this queues the synced intent and resumes the download on reconnect ([[12-offline-save-sync]]); the modal closes.
4. **Dismiss** closes it; it does not reappear for that book in the same session (re-emit for a different book replaces the current one).
5. Online, or once the book is fully/explicitly saved, the notice never shows.

## Data & sync
No new buckets/endpoints. Reads: `useNetworkState`, `readOfflineState` (absent/auto/explicit), `readCachedChapterIds().length`, TOC count from the reader payload. Pure decision in `partial-offline.ts` (`shouldShowPartialOfflineNotice`), so it's unit-tested without Dexie. Save action reuses the book bucket.

## Edge cases
Unknown total (empty TOC) → no notice (don't guess). Fully auto-cached book (cached == total) → no notice. Connection returns while open → modal stays until dismissed (the counts were true on open); a later open re-evaluates. Save tapped offline → queued, resumes on reconnect, no error toast.

## Acceptance criteria
- [ ] Opening a partially-cached book offline shows the modal with correct "N of M" counts.
- [ ] An explicitly-saved or fully-cached book shows nothing; online shows nothing.
- [ ] Save offline from the modal queues the book and resumes the download on reconnect.
- [ ] Dismiss hides it and it doesn't re-show for that book that session.

## Open questions
Whether to also surface the count passively in the reader header; re-prompting after a failed/again-partial reconnect.
