# Background cache priming

> Status: active · Updated: 2026-06-17 · ADRs: [[3-offline-first-dexie-buckets]] · Related: [[12-offline-save-sync]], [[14-route-precaching]] · Code: apps/web/features/offline/{prime,status}, apps/web/components/app/core/{header-status-chip,caching-indicator}.tsx

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
6. **Progress chip:** while the content tier runs, the page/reader header shows a non-interactive pill "Caching for offline access {done}/{total} books" (`done` = books handled, `total` = offline-marked books). Reported per book to a client store (no SW), held ~2s after the last book, then hidden. It owns the one header status slot: offline → Offline chip wins; else priming → this chip; else nothing. A warm (completed) device only re-primes to reconcile a newly-requested offline book, so the chip appears just for that.
7. **Reconcile (after completion):** once `prime:completed`, the primer skips the bulk passes but on every reconnect / app load still downloads any `offlineRequested` book whose content is missing — e.g. one marked offline later, possibly while disconnected. Page-independent; consent-exempt (the explicit request is the consent); a no-op when nothing is outstanding ([[12-offline-save-sync]]).

## Data & sync
Reuses home/library/book/preferences/highlights/ai-comments buckets — no parallel mechanism. Bookkeeping (`prime:*` flags, `prime:content:consent`) in the Dexie `meta` table (per-device). Content target = `offlineRequested && !hasBookContent`.

## Edge cases
Offline mid-pass / page closed → done-flag unset, resumes. Save-Data ON + declined → content skipped this run, re-offered next session. Library fetch fails → no enumeration, retry. Quota floor reached → terminal + warning toast. User opens a book mid-prime → that save wins.

## Acceptance criteria
- [ ] Metadata for all smart-collection books — plus user preferences — primes on first home load (even under Save-Data).
- [ ] Content + highlights + AI comments prime only for `offlineRequested` books, gated by the Save-Data modal.
- [ ] Content tier never aborts a user-initiated save and stops at the quota floor with a toast.
- [ ] A declined modal skips content without being remembered; interrupted passes resume.
- [ ] During content priming the header shows "Caching for offline access n/m books" climbing to completion; it yields to the Offline chip when offline and, on a warm (completed) device, appears only while a reconcile download runs.
- [ ] A book marked offline after the device has completed priming downloads on the next reconnect (reconcile), without re-running the metadata tier or re-prompting Save-Data consent.

## Open questions
Freshness of never-revisited offline content (no background pull-refresh today).
