# Library & collections

> Status: shipped · Updated: 2026-06-11 · ADRs: [[3-offline-first-dexie-buckets]],
> [[4-route-precaching-service-worker]] · Code: apps/web/components/app/library,
> apps/web/features/offline/buckets/library

## Summary
The user's personal book collection plus curated reading lists, with a per-book info/detail page.
Serves the "organize a library, collections, reading lists" job.

## Scope
- In: library grid (cover, title, progress), book-info detail (description, stats, read/save
  actions), collections (create, rename, delete, add/remove, reorder), offline-cached metadata with
  revalidation.
- Non-goals: catalog/discovery (explore — future), sharing collections (social — future), import
  flow internals.

## Behaviour
1. Library lists the user's books with progress; clicking opens book-info or the reader.
2. Collections group books into CUSTOM or SMART lists; user edits membership and order.
3. Metadata is cached for offline; revalidates against server updatedAt when online.

## Data & sync
library bucket (items + collections + membership, normalized); book-info details lazy-loaded once
and cached. GET /library snapshot; revalidation skips unchanged fetches.

## Edge cases
Offline browse from cache; collection edits offline then sync; book in multiple collections; empty
library/collection states. Book-info + collection pages are generic client shells
([[4-route-precaching-service-worker]]) hydrated from Dexie by `location` slug. The library list
tolerates an unreachable API or an unverifiable (stale, Clerk-offline) session —
`fetchServerApiTolerant` returns null → renders `LibraryScreenFromCache` rather than the error
boundary.

## Acceptance criteria
- [ ] Library and collections render offline from cache.
- [ ] Creating/renaming/reordering a collection persists and survives reload.
- [ ] Book-info shows progress and offers read + save-offline actions.

## Open questions
Smart-collection rule editor; collection sharing (depends on social).
