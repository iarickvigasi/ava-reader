# Background cache priming

> Status: active · Updated: 2026-06-30 · ADRs: [[3-offline-first-dexie-buckets]] · Related: [[12-offline-save-sync]], [[14-route-precaching]] · Code: apps/web/features/offline/{prime,status}, apps/web/components/app/core/{header-status-chip,caching-indicator}.tsx

## Summary
On the first load of any `/app` route (the primer island lives in AppShell, not just home — a fresh device may enter via a deep link), proactively fill offline caches in the background so the home, library, and the user's offline-marked books work with no network — without visiting each screen first. Serves the offline-first job (product.md).

## Scope
- In: a client island on /app that, while online, primes two tiers — (1) cheap metadata for every book, (2) heavy content only for books the user marked offline.
- Non-goals: downloading content for un-marked books (those load when opened); ongoing freshness (per-route `revalidate*` owns that); new list endpoints.

## Behaviour (tiers)
1. **Metadata (always when online):** home (incl. stats), library + collections, per-book info for all smart-collection books, and user **preferences** (`GET /api/me/preferences`). Skipped only on slow-2g/2g.
2. **Content (offline-marked books only):** for each book with `offlineRequested` ([[12-offline-save-sync]]) not yet cached locally — save chapters + cover (`saveBookOffline` explicit, sequential), plus its **highlights** (`/annotations`) and **AI comments** (`/ai-comments`). Stats need nothing extra (home payload covers them).
3. **Save-Data gate (content tier only):** Save-Data OFF → run automatically. Save-Data ON → show a Yes/No modal ("Save your books for offline reading?"). A grant is remembered (`prime:content:consent=granted`); a decline is **not** persisted — we re-offer next session (Save-Data may be off by then). Metadata tier ignores Save-Data (negligible).
4. Yields to the user: an in-flight save or a cancelled outcome pauses the content tier; resumes on the next reconnect or app load.
5. **Low storage:** when the content tier stops at the quota floor, a warning toast tells the user the device is low on space (so they can free some and let the rest cache).
6. **Progress chip:** the page/reader header shows a non-interactive pill with two states, reported to a client store (no SW):
   - **Content** — "Caching for offline access {done}/{total} books" while offline-marked content downloads (`done` = books handled, `total` = offline-marked books). Skipped (no pill) when nothing is marked offline.
   - **Ready** — on the first transition to `prime:completed`, a brief "Ready for offline work" confirmation, held ~5s (`DWELL_MS` in `use-header-chip`), then hidden. This is the "safe to browse offline" cue — it fires even when no book is marked offline (the metadata-only case). Only on first completion (a warm device early-returns before it), and after a reconcile download finishes.
   The pill owns the one header status slot (which reserves its chip height, so going offline/priming never reflows the header or shifts reader content): offline → Offline chip wins; else content → ready → nothing. A run that ends without completing (offline mid-pass, blocked on Save-Data consent) clears the pill rather than leaving a stuck count.
7. **Reconcile (after completion):** once `prime:completed`, the primer skips the bulk passes but on every reconnect / app load still downloads any `offlineRequested` book whose content is missing — e.g. one marked offline later, possibly while disconnected. Page-independent; consent-exempt (the explicit request is the consent); a no-op when nothing is outstanding ([[12-offline-save-sync]]).

## Data & sync
Reuses home/library/book/preferences/highlights/ai-comments buckets — no parallel mechanism. Bookkeeping (`prime:*` flags, `prime:content:consent`) in the Dexie `meta` table (per-device). Content target = `offlineRequested && !hasBookContent`.

## Edge cases
**Cold-load kick vs. auth timing:** the kick edge (`wasOnline`, in `reduceKick`) only advances once Clerk is ready (`isLoaded && isSignedIn`). Clerk's `isLoaded` is false on the first render(s), so advancing the edge there would consume the first-online transition before the auth gate passes — the cold-load kick would be lost and the primer would run only on a later offline→online flip, which is why book-info details never cached on a normal online load. While not ready, the edge holds and nothing kicks; the first ready render is the transition. Offline mid-pass / page closed → done-flag unset, resumes. Save-Data ON + declined → content skipped this run, re-offered next session. Library fetch fails → no enumeration, retry. Quota floor reached → terminal + warning toast. User opens a book mid-prime → that save wins. **Metadata never goes clean** (one book's `/api/library/[slug]` persistently fails — deleted server-side but still in the cached library view, slug mismatch, endpoint bug) → `prime:metadata:doneAt` is never set, so the primer re-fetches every book-info on each load and that book's details never cache offline, surfacing as the offline route fallback on its details page.

## Acceptance criteria
- [ ] Metadata for all smart-collection books — plus user preferences — primes on first home load (even under Save-Data).
- [ ] Content + highlights + AI comments prime only for `offlineRequested` books, gated by the Save-Data modal.
- [ ] Content tier never aborts a user-initiated save and stops at the quota floor with a toast.
- [ ] A declined modal skips content without being remembered; interrupted passes resume.
- [ ] On first completion the header shows a brief "Ready for offline work" — including when no book is marked offline (metadata-only); the metadata tier itself is not surfaced as a chip.
- [ ] During content priming the header shows "Caching for offline access n/m books" climbing to completion; it yields to the Offline chip when offline and, on a warm (completed) device, appears only while a reconcile download runs.
- [ ] A run that ends blocked on Save-Data consent or by going offline clears the pill instead of leaving a stuck count.
- [ ] A book marked offline after the device has completed priming downloads on the next reconnect (reconcile), without re-running the metadata tier or re-prompting Save-Data consent.

## Open questions
Freshness of never-revisited offline content (no background pull-refresh today).
