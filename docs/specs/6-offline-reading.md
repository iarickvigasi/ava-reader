# Offline reading (save for offline)

> Status: shipped · Updated: 2026-06-09 · ADRs: [[3-offline-first-dexie-buckets]] · Related: [[12-offline-save-sync]], [[13-offline-save-button]] · Code: apps/web/features/offline/buckets/book

## Summary
Downloads a book's full content (chapters + cover) into Dexie so it can be read with no network. Underpins the offline-first promise.

## Scope
- In: explicit "save offline" action, auto-save of the opened book's first chapter, full-book download with resume + quota guard, eviction of auto-saves.
- Non-goals: syncing annotations (own buckets), background prefetch of the whole library.

## Behaviour
1. User taps Save offline on book-info → all chapters + cover download into Dexie (bounded concurrency). Tapping mid-download aborts ("cancelling…" → idle); offline, the request is queued and resumes on reconnect.
2. Opening an uncached book auto-saves it so reading starts immediately (the single evictable auto-slot).
3. Explicit saves are sticky; the evictable auto-cache is dropped when the user opens **another** book — driven by the reader, not the save. While a book is open, online, and its own content is cached, every *other* `savedAutomatically && !savedOffline` book is deleted. So opening an already-saved book evicts the previous auto-cache too (not only a fresh auto-save), and a stale auto-cache left by a release is reclaimed on the next open. Re-running a save skips cached chapters. The book-info card's full state machine (keep / release / remove / cancel / abort) lives in [[13-offline-save-button]].

## Data & sync
book bucket + reader-cache (chapter blobs), quota.ts enforcement. Read path prefers Dexie; the reader serves cached chapters offline.

## Edge cases
Storage quota exceeded → toast + stop; interrupted download → resume; eviction while reading the evicted book; cover missing. Offline never evicts: opening another book while disconnected keeps the previous auto-cache (you may return to it) and drops it later, on reconnect — and never the book currently open (it's exempt as "engaged"). An uncached new book reclaims the previous auto-cache only after its own download finishes, so a mid-download disconnect never leaves you with neither book. Two saves of the same book overlapping (e.g. the primer and the book-info card both react to reconnect) → the newer save takes over (single-flight); the superseded one must NOT delete the book's rows or clear the new save's in-flight slot (ownership fence).

## Acceptance criteria
- [ ] A saved book reads fully offline, including cover.
- [ ] Download resumes after interruption without re-fetching cached chapters.
- [ ] Hitting quota surfaces a toast and stops cleanly; explicit saves outrank auto-saves.
- [ ] Opening a second book online drops the previous auto-cache — including when the second book was already saved offline.
- [ ] Opening another book offline keeps the previous auto-cache until reconnect; the book currently open is never evicted.
- [ ] Overlapping saves of the same book never delete or corrupt a completed download.

## Open questions
Per-user storage budget UI; whole-collection save; cache expiry policy.
