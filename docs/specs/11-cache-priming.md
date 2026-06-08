# Background cache priming

> Status: active · Updated: 2026-06-07 · ADRs: [[1-offline-first-dexie-buckets]] · Code: apps/web/features/offline/prime

## Summary
On the first home load per device, proactively populate every offline cache in the background so library, book-info, and reader content work offline without the user visiting each screen first. Serves the offline-first job (product.md).

## Scope
- In: a client island on /app that, while online and not on a metered connection, primes two tiers — metadata (home, library list, per-book info) then book content (reader chapters + cover) — for every book in the default smart collections.
- Non-goals: ongoing freshness (per-route `revalidate*` owns that); custom-collection-only books (none exist by design); a UI/progress surface; new API endpoints.

## Behaviour
1. Runs once per device, scheduled at idle after home hydration; never blocks render.
2. Suppressed when offline or `navigator.connection.saveData` / effectiveType is slow-2g/2g.
3. Tier 1 reuses `revalidate{Home,Library,BookInfo}`; tier 2 saves each book via `saveBookOffline` (explicit, sequential, quota-gated at 500 MB headroom).
4. Yields to the user: a save in flight or a cancelled outcome pauses tier 2; it resumes next home load.
5. A tier's done-flag is set only on a terminal pass; both terminal → `prime:completed`, never runs again.

## Data & sync
Reuses the home, library, and book buckets — no parallel mechanism. Bookkeeping flags (`prime:metadata:doneAt`, `prime:content:doneAt`, `prime:completed`) live in the Dexie `meta` table (per-device == per-database). Book slugs/ids enumerated from `kind === "SMART"` collections.

## Edge cases
Offline mid-pass, Save-Data flipped, page closed → flag unset, resumes. Library fetch fails → no enumeration, retry. Storage floor reached → terminal (logged drop count). User opens a book mid-prime → that save wins, primer steps aside.

## Acceptance criteria
- [ ] Priming runs at most once per device on full success; interrupted runs resume.
- [ ] No priming when offline or on a Save-Data/slow connection.
- [ ] Only smart-collection books are enumerated, deduped.
- [ ] Tier 2 never aborts a user-initiated save; stops at the quota floor.

## Open questions
Re-prime cadence for freshness of never-revisited offline content (currently none — relies on per-route revalidation).
