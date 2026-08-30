# Offline Books collection

> Status: active · Updated: 2026-08-10 · ADRs: [[3-offline-first-dexie-buckets]] · Related:
> [[7-library/_overview]], [[12-offline-save-sync]], [[13-offline-save-button]] · Code:
> apps/api/src/shared/default-collections.ts, apps/api/src/library,
> apps/web/features/offline/buckets/library

## Summary
A third default SMART collection, **Offline Books**, holding every book the user marked to keep
offline. Gives the "organize a library" job a single shelf answering "what did I save to read
without a connection", on every device.

## Scope
- In: the default collection row, membership driven by `offlineRequested`, localized name +
  description, a tailored empty state, and a delete guard for all SMART collections.
- Non-goals: per-device "what's actually cached here" (that stays the book-info card's job,
  [[13-offline-save-button]]), manual add/remove of members, storage-budget UI.

## Behaviour
1. The collection is created alongside the other defaults on the user's first import, and exists
   whether or not anything is saved offline. Empty, it shows "Books you save for offline reading
   appear here" instead of the generic no-books copy.
2. Membership = `offlineRequested` ([[12-offline-save-sync]]), so it is the same set on every
   device. A book still downloading on this device is listed; its card reads "Download queued".
3. Its position is computed like every other shelf's ([[7-library/7.1-library-screen]] §3), not
   fixed. Because its books are duplicates of the source shelves it usually ties them on recency
   and then leads them on item count. `sortOrder: 2` survives only to order the book-info
   collection chips.
4. Like every SMART collection it cannot be renamed or deleted.

## Data & sync
`DEFAULT_SMART_COLLECTIONS` gains `smartKey: 'offline-books'` (slug `offline-books`). It is *not*
returned by `getSmartCollectionKey`, which maps import source to shelf; this shelf is not
source-based. `setOfflineRequested` becomes transactional — it flips the flag and upserts/deletes
the `CollectionItem` together. No schema change is needed; `pnpm db:backfill-offline-books` creates
the row for every user holding a `LibraryItem` and seeds membership from `offlineRequested = true`.

**Client membership is derived, not read.** For this `smartKey` the library bucket ignores the
cached `collectionMembership` rows and filters `libraryItems` on `offlineRequested`. Same rule the
server applies, evaluated locally — so a toggle made offline moves the book immediately instead of
waiting for the dirty PATCH to flush. The server row still owns id, slug, name, kind and
description. Order stays engagement-based, matching `compareLibraryItemsByEngagement`.

**The counts are not derived that way.** A library payload caches only each collection's 4-book
preview, so counting cached rows would report a fraction of the shelf — and that fraction feeds
the display-order tiebreak ([[7-library/7.1-library-screen]] §3). itemCount/unreadCount take the
server's stored counts, which cover the whole collection, and adjust them by the toggles the
server hasn't seen: rows whose `offlineRequested` differs from `offlineRequestedBaseline`, the
value the last payload carried. The baseline follows the payload, never the PATCH ack — clearing
it on the ack would drop a toggle out of the count while the cached collection row still held the
pre-toggle total, so the save would appear to undo itself.

## Edge cases
Toggle while offline → derived membership updates at once; the PATCH follows on reconnect. Saved on
another device → listed here before the content arrives; the primer fetches it
([[11-cache-priming]]). Download failed or storage floor hit → listed without content;
`resolveOfflineReadAction` already gates the read link. Book archived or removed → `CollectionItem`
cascades and `serializeCollection` filters archived. A pre-existing CUSTOM collection named
"Offline Books" → the unique `(userId, name)` is resolved the way the slug already is, so import
cannot fail on it; the stored name becomes "Offline Books (2)" while the shelf still *displays* the
localized name, so that user sees two same-titled shelves until they rename theirs. The count's
base is the last *synced* total, so a book-info visit can refresh a row's baseline without
refreshing the shelf's stored total; counts clamp at zero and the next library load restores both
together.

## Acceptance criteria
- [ ] A user with books but nothing saved offline sees the empty Offline Books shelf, localized.
- [ ] Saving a book offline adds it to the shelf; removing it takes it off, both while offline.
- [ ] A book saved on device A appears on the shelf on device B after its next library load.
- [ ] The shelf renders from cache while offline and lists exactly the `offlineRequested` books.
- [ ] Its item count matches the collection page's, not the number of preview cards on screen, and
      moves by one the moment a book is saved or released while offline.
- [ ] Neither Offline Books nor any other SMART collection can be renamed or deleted, API included.
- [ ] Existing users get the collection without importing a new book.

## Open questions
Whether an empty Offline Books row should be hidden on the home dashboard — today every collection
is listed, and special-casing it would change behaviour for empty CUSTOM collections too.
