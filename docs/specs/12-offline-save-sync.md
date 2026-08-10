# Offline-save sync (server-synced intent)

> Status: active · Updated: 2026-08-10 · ADRs: [[3-offline-first-dexie-buckets]] · Related:
> [[6-offline-reading]], [[11-cache-priming]], [[13-offline-save-button]],
> [[17-offline-books-collection]] · Code: apps/api/src/library,
> apps/web/features/offline/buckets/{library,book}

## Summary
Persist "keep this book available offline" as a server-side, per-user intent so it follows the user
across devices. A new device then auto-downloads everything the user marked offline, instead of the
choice being trapped in one device's Dexie.

## Scope
- In: a synced `offlineRequested` flag on LibraryItem; an endpoint to toggle it; carrying it in
  library/home payloads; web wiring so the existing Save-offline button writes it; the primer
  consuming it.
- Non-goals: device-specific cache management, per-device storage budgets, syncing *which* device
  holds content (only the intent syncs, never the bytes).

## Naming (the key distinction)
- **`offlineRequested`** — server intent, synced. "User wants this offline." Source of truth =
  server.
- **`savedOffline`** — existing per-device Dexie flag = "content is actually cached on THIS device."
  Unchanged meaning.
- Primer target = `offlineRequested === true && !hasBookContent(id)` → download here.

## Behaviour
1. Tapping Save offline sets `offlineRequested=true` (optimistic local, queued) and downloads
   content; if offline, the intent is queued and the download resumes on reconnect (no error toast).
   Remove sets it false.
2. Library/home payloads carry `offlineRequested` per book; Dexie mirrors it (server wins on
   hydrate; local `savedOffline`/cover preserved unless a local toggle is still dirty).
3. On any device, the primer downloads content for `offlineRequested` books not yet cached locally
   (see [[11-cache-priming]]).

## Resume (survives leaving the page)
The queued state and its download hang off the **durable** `offlineRequested` flag, never component
state — so a request made offline survives navigation and completes later unattended:
- The button derives "Download queued" from Dexie (`offlineRequested && !hasBookContent`), so
  re-opening the page shows the real state, not idle ([[13-offline-save-button]]).
- The primer's reconcile pass ([[11-cache-priming]]) fetches the content on the next reconnect / app
  load — page-independent and **not** gated by the once-per-device `prime:completed` flag. An
  explicit request is consent-exempt (the tap is the consent) even under Save-Data.
- While on the page and online the button also starts the download immediately; the primer is the
  page-independent safety net.

## Data & sync
LibraryItem gains `offlineRequested Boolean @default(false)` — a plain boolean; no timestamp, since
the boolean alone drives auto-download and concurrent PATCHes resolve by server arrival order.
`PATCH /api/library/:slug/offline {requested}`. `LibraryCardBook.offlineRequested?: boolean`. The
toggle goes through a per-row dirty flag flushed on reconnect (offline-capable), mirroring the
preferences bucket. The same transaction syncs the book's membership in the Offline Books smart
collection ([[17-offline-books-collection]]).

## Edge cases
Toggle while offline → queued (dirty), optimistic, flushed on reconnect; the content download
resumes then (see Resume). Conflicting toggles across devices → last PATCH to reach the server wins.
Server says requested but content fetch fails → primer retries next pass. Book removed from library
→ flag gone with the row.

## Acceptance criteria
- [ ] Marking a book offline on device A makes device B auto-download it on next home load.
- [ ] The flag survives library revalidation and reflects the server after cross-device change.
- [ ] Toggling offline works while disconnected and syncs on reconnect.
- [ ] A save requested offline completes in the background after reconnect even if the user left the
  book-info page.

## Open questions
Bulk "make N books offline" UX; storage-budget arbitration when intent exceeds device quota.
