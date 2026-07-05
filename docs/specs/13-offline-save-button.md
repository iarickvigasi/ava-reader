# Offline-save button (book-info card)

> Status: active · Updated: 2026-06-17 · ADRs: [[3-offline-first-dexie-buckets]] · Related:
> [[6-offline-reading]], [[12-offline-save-sync]] · Code:
> apps/web/components/app/library/book-info/download-offline-card.tsx

## Summary
The single control on the book-info screen for making a book available offline. Its label + action
are derived entirely from local Dexie state (`DownloadOfflineCard` via `useBookOfflineState`), so it
reads correctly online and offline.

## Inputs (Dexie flags)
- `savedOffline` — explicit, sticky; eviction-protected.
- `savedAutomatically` — origin marker (the book was auto-cached while reading). With
  `!savedOffline` it's the evictable auto-slot; it also distinguishes the two "saved" flavours.
- `offlineRequested` (+ `offlineRequestedDirty`) — server-synced intent ([[12-offline-save-sync]]);
  the dirty flag drives offline-capable sync, and the flag itself drives the **queued** state
  (Dexie-derived, so it survives leaving the page).
- content present? (`hasBookContent`) and save status (`saving`).

## States (first match wins)
| State | Condition | Label | Tap |
|---|---|---|---|
| cancelling | aborting | "Cancelling download" | — (disabled) |
| downloading | status = saving | "Saving for offline {n}/{m}" | **abort**: stop + delete partial rows + clear intent → idle |
| saved | explicit & `savedAutomatically` | "Saved offline" | **release** (flag-only, content kept) → keep |
| remove | explicit & `!savedAutomatically` | "Remove from downloads" | **delete** content + clear intent → absent |
| queued | `offlineRequested` & no content & not saving | "Download queued" | **cancel** request (clear intent) → absent |
| keep | content & `!savedOffline` (auto) | "Keep for offline" | **promote** (flag-only, no download) → saved |
| absent | no content | "Save for offline" | **request**: set intent + download |

## Actions (what each does)
- **request** → `setBookOfflineIntent(true)` + downloads via `save("explicit")`. Offline → stays
  *queued*, resumes on reconnect.
- **promote** → `promoteBookOffline`: sets `savedOffline`+`offlineRequested`; instant, no download
  (content already cached).
- **release** → `releaseBookOffline`: clears `savedOffline`/`offlineRequested`, sets
  `savedAutomatically` → evictable auto-cache. Content **not** deleted; reclaimed later by eviction.
- **delete** → clear `offlineRequested`, then `deleteBookContent` (chapters + cover + flags). Frees
  space now.
- **abort** → `abortSaveAndWait` (resolves after teardown) + clear intent. **cancel** → drop the
  queued request.

## Offline behaviour
Every label comes from Dexie, so the card is correct offline — including **queued**, which derives
from `offlineRequested` (not transient UI state), so a request made offline still reads as queued
after navigating away and back. promote / release / delete / cancel / abort all take effect locally
with no network; the `offlineRequested` PATCH defers via the dirty flag and flushes on reconnect
from the library, collection, or book-info page. A *request* made offline queues; the content
download then runs unattended via the primer's reconcile pass on reconnect ([[11-cache-priming]]),
whether or not the user is still on the page.

## Acceptance criteria
- [ ] Label matches the Dexie state in the table, offline included.
- [ ] An auto-saved book promoted then released returns to "Keep for offline" with content intact;
  an explicit download's "Remove" deletes content and returns to "Save for offline".
- [ ] Cancel/abort never leave a half-saved book or a stuck "saving" state; clearing intent stops
  the primer re-downloading.
- [ ] A request made offline still shows "Download queued" after leaving and reopening the page, and
  its content arrives in the background after reconnect.

## Open questions
Confirm dialog for the destructive "Remove from downloads"? On-demand "free space" for
kept-from-auto books (today only eviction reclaims them).
