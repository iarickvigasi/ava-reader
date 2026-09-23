# Offline (overview)

> Status: active · Updated: 2026-09-02 · ADRs: [[3-offline-first-dexie-buckets]],
> [[4-route-precaching-service-worker]], [[5-per-user-offline-database]] · Related:
> [[3-library/_overview]], [[7-auth]] · Code: apps/web/features/offline, apps/web/public/sw.js

## Summary
Everything that makes the app work with no network: downloading book content, keeping the app shell
loadable, priming caches ahead of time, isolating one account's data from another's, and syncing
local changes back when the connection returns. Serves the offline-first job (product.md), which
[[3-offline-first-dexie-buckets]] makes non-negotiable: user data flows through a bucket, never a
raw fetch. Split by subsystem, like [[2-reader/_overview]].

## Sub-specs
- 6.1 offline-reading — downloading a book's content + the offline read path.
- 6.2 save-sync — the server-synced "keep this book offline" intent and its flush.
- 6.3 save-button — the book-info card's save/release state machine.
- 6.4 cache-priming — priming content + metadata ahead of a disconnect, and its progress cue.
- 6.5 route-precaching — the service worker: which shells are cached, and what must never be.
- 6.6 sw-code-organization — how sw.js is laid out (code organization only, no behaviour).
- 6.7 data-isolation — per-user Dexie DB, cache + localStorage clearing on sign-out/switch.
- 6.8 offline-books-collection — the SMART shelf listing what is saved offline.
- 4.9 header-avatar — always-visible header avatar slot + offline profile-photo caching.
- 4.10 slow-connection — the "Slow" header badge + cache-first document fallback on a degraded
  (online but unresponsive) connection.
- 4.11 completion-counts — whole-library completion snapshots, pending edits, and per-aggregate
  reconciliation when only some books are cached.

## Shared data model — what is authoritative for what
Three substrates hold offline state. **Which one owns a fact decides which one a read may trust.**

**1. Dexie, per user** (`ava-reader-<userId>`, [[4.7-data-isolation]]). Four kinds of table, and
conflating them is the recurring bug:

- **Local truth** — `highlights`, `aiComments`, `sessions`, `progress`, `preferences`, each paired
  with a `*Mutations` queue. The device is right until the queue flushes; a server payload never
  stomps a row with pending local edits.
- **Downloaded content** — `books`, `bookChapters`, and `libraryItems.coverBlob`. **The authority on
  what can be read offline.** Written by an explicit save or an auto-save ([[4.1-offline-reading]]),
  removed by eviction or a confirmed library-item deletion.
- **Server-payload projections** — `libraryItems`, `collections`, `collectionMembership`. Rebuilt by
  `clear()` + `bulkPut()` from the last `GET /library`. **Never authoritative for anything.** That
  payload carries only each collection's first **4 books** ([[3.5-library-payloads]]), so these
  tables hold a *fraction* of the library and their contents churn as engagement reorders the
  previews. Offline-save flags and cached details are carried across the rebuild; nothing else is.
- **Scalars + snapshots** — `meta` (`library:booksCount`, `prime:*` timestamps) and the single-row
  `me` / `home` caches. `meta` exists precisely because counts *cannot* be re-derived from the
  projections above.

**2. Cache Storage** (`ava-reader-sw-<build>`): HTML documents + hashed `/_next/static` assets,
keyed per pathname and evicted wholesale on each new build. RSC payloads are deliberately absent —
they vary by router state and cannot be keyed per path ([[4.5-route-precaching]] §5).

**3. localStorage**: the `ava-reader:active-user` marker — who Dexie opens for before Clerk boots.
Correct offline by construction, since identity can only change online.

### Write paths — who may delete
A payload may only delete what it can prove absent. `GET /library` supplies a complete
`libraryItemIds` set alongside its four-book previews. Only that identity set authorizes deletion;
an older response without it continues to upsert books without inferring absence from previews.

| table | `applyLibraryPayload` | `applyCollectionPayload` (full) |
| --- | --- | --- |
| `collections` | replace — it lists them all | upsert the one |
| `libraryItems` | upsert, then delete IDs absent from the complete identity set | upsert (merge local flags) |
| `collectionMembership` | replace complete shelves; merge partial previews | replace for that collection |

Within the replacement transaction, missing identities cascade to downloaded books, chapters,
cover blobs, translations, highlights, AI comments, progress, and their pending book mutations.
An index-only orphan sweep also finds content whose library row was removed by an older client.
Confirmed deletion overrides pending book edits; it never removes sessions or session replay queues.
Deletion markers fence late responses and writes in other tabs so they cannot restore deleted data.
The book-info DELETE flow and a confirmed book-info 404 use the same cascade.

The app refreshes library identities on authenticated startup, reconnection, and return to a
visible tab, independently of the once-only primer. The legacy primer can still prune after a
complete collection pass, preserving pending membership, finish-date, and offline-intent edits.

### The rule
**Never gate a read on a projection.** Ask the table that owns the thing: "can I read this book
offline?" is a question for `books`, not `libraryItems`. Resolving a reader slug through
`libraryItems` alone made fully-downloaded books report "This page needs a connection" whenever they
had drifted out of every collection preview — see [[4.1-offline-reading]] Read path. The same shape
is behind the Offline Books count gap in [[4.8-offline-books-collection]].
