# Library (overview)

> Status: shipped · Updated: 2026-08-28 · ADRs: [[3-offline-first-dexie-buckets]],
> [[4-route-precaching-service-worker]] · Related: [[6.8-offline-books-collection]],
> [[6.2-save-sync]] · Code: apps/web/components/app/library,
> apps/web/features/offline/buckets/library, apps/api/src/library

## Summary
The user's personal book collection: importing books, organizing them into collections, a per-book
info page, and the server payloads behind all of it. Serves the "organize a library, collections,
reading lists" job. Split by subsystem, like [[1-reader/_overview]].

## Sub-specs
- 7.1 library-screen — the library page: collection sections, book cards, offline rendering.
- 7.2 book-info — per-book detail page: stats, collections, read/save actions.
- 7.3 collections — collection model and rules: CUSTOM vs SMART, guards, membership.
- 7.4 import — server ingest: upload → metadata → blobs → processing run → shelves.
- 7.5 library-payloads — server reads and the serialized shapes.

## Shared data model
- **LibraryItem** — the user↔book link: per-user slug, source (IMPORTED | CATALOG),
  offlineRequested, isArchived, addedAt/lastOpenedAt, one ReadingProgress row.
- **Collection** {kind: CUSTOM | SMART, smartKey?, name, slug, sortOrder} with CollectionItem
  membership rows; SMART shelves are system-owned ([[6.8-offline-books-collection]]).
- **Book card** (serialized) — {libraryItemId, slug, title, authors, coverImageUrl,
  completionPercent, lastReadAt, offlineRequested, primaryFormat}: the one shape every book list
  renders (library, collection pages; home mirrors it).
- **Active item** — a LibraryItem with isArchived false. Every count, preview and sort in the
  library runs over active items only; archived ones never render. Nothing archives yet, so in
  practice this is currently every item.
- **Engagement recency** = max(progress.lastReadAt, lastOpenedAt, addedAt) — the sort key for
  every book list, and (taken as a collection's maximum) the first key ordering the
  collections themselves ([[7.1-library-screen]] §3).

## Scope (whole feature)
- In: everything in the five sub-specs.
- Non-goals: reading itself ([[1-reader/_overview]]), catalog/discovery (explore — future),
  sharing collections (social — future), offline content download ([[6.1-offline-reading]]).

## Cross-cutting acceptance
- [ ] Library, collections, and book-info render offline from cache.
- [ ] An imported or catalog-added book appears in its smart shelf with progress at 0.
- [ ] Every book list orders by engagement recency and excludes archived items.

## Open questions
Collection create / add-remove / reorder (no endpoints yet); smart-collection rule editor;
collection sharing (depends on social).
