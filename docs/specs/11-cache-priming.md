# Background cache priming

> Status: active · Updated: 2026-06-07 · ADRs: [[3-offline-first-dexie-buckets]] · Related: [[12-offline-save-sync]] · Code: apps/web/features/offline/prime

## Summary
On home load, proactively fill offline caches in the background so the home, library, and the user's offline-marked books work with no network — without visiting each screen first. Serves the offline-first job (product.md).

## Scope
- In: a client island on /app that, while online, primes two tiers — (1) cheap metadata for every book, (2) heavy content only for books the user marked offline.
- Non-goals: downloading content for un-marked books (those load when opened); ongoing freshness (per-route `revalidate*` owns that); new list endpoints.

## Behaviour (tiers)
1. **Metadata (always when online):** home (incl. stats), library + collections, per-book info for all smart-collection books, and user **preferences** (`GET /api/me/preferences`). Skipped only on slow-2g/2g.
2. **Content (offline-marked books only):** for each book with `offlineRequested` ([[12-offline-save-sync]]) not yet cached locally — save chapters + cover (`saveBookOffline` explicit, sequential), plus its **highlights** (`/annotations`) and **AI comments** (`/ai-comments`). Stats need nothing extra (home payload covers them).
3. **Save-Data gate (content tier only):** Save-Data OFF → run automatically. Save-Data ON → show a Yes/No modal ("Save your books for offline reading?"). A grant is remembered (`prime:content:consent=granted`); a decline is **not** persisted — we re-offer next session (Save-Data may be off by then). Metadata tier ignores Save-Data (negligible).
4. Yields to the user: an in-flight save or a cancelled outcome pauses the content tier; resumes next home load.
5. **Low storage:** when the content tier stops at the quota floor, a warning toast tells the user the device is low on space (so they can free some and let the rest cache).

## Data & sync
Reuses home/library/book/preferences/highlights/ai-comments buckets — no parallel mechanism. Bookkeeping (`prime:*` flags, `prime:content:consent`) in the Dexie `meta` table (per-device). Content target = `offlineRequested && !hasBookContent`.

## Edge cases
Offline mid-pass / page closed → done-flag unset, resumes. Save-Data ON + declined → content skipped this run, re-offered next session. Library fetch fails → no enumeration, retry. Quota floor reached → terminal + warning toast. User opens a book mid-prime → that save wins.

## Acceptance criteria
- [ ] Metadata for all smart-collection books — plus user preferences — primes on first home load (even under Save-Data).
- [ ] Content + highlights + AI comments prime only for `offlineRequested` books, gated by the Save-Data modal.
- [ ] Content tier never aborts a user-initiated save and stops at the quota floor with a toast.
- [ ] A declined modal skips content without being remembered; interrupted passes resume.

## Open questions
Freshness of never-revisited offline content (no background pull-refresh today).
