// Dexie I/O for the library bucket. The bucket's in-memory state is the
// authoritative read source for components; this file is the slow path used
// during hydration + revalidation only.

import type {
  LibraryBookInfo,
  LibraryCollection,
  LibraryCollectionBook,
  LibraryPayload,
} from "@/lib/api-types/library";

import {
  getDb,
  type CollectionMembershipRow,
  type CollectionRow,
  type LibraryItemRow,
} from "../../db";

import type { CollectionView, LibraryBookView, LibraryView } from "./types";

// Reads everything we need to render the library screen in one transaction.
// Returns null when the DB is empty — caller treats that as "never hydrated"
// and falls back to the SSR/RSC payload it was given.
export async function readLibraryView(): Promise<LibraryView | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [db.libraryItems, db.collections, db.collectionMembership],
    async () => {
      const collections = await db.collections.toArray();
      if (collections.length === 0) {
        return null;
      }
      const items = await db.libraryItems.toArray();
      const itemsById = new Map(items.map((row) => [row.libraryItemId, row]));
      const membership = await db.collectionMembership.toArray();

      const byCollection = new Map<string, CollectionMembershipRow[]>();
      for (const link of membership) {
        const list = byCollection.get(link.collectionId);
        if (list) {
          list.push(link);
        } else {
          byCollection.set(link.collectionId, [link]);
        }
      }

      const views: CollectionView[] = collections.map((collection) => {
        const rawLinks = byCollection.get(collection.id) ?? [];
        const sorted = [...rawLinks].sort((a, b) => a.order - b.order);
        const books: LibraryBookView[] = [];
        for (const link of sorted) {
          const row = itemsById.get(link.libraryItemId);
          if (row) {
            books.push(toBookView(row));
          }
        }
        return collectionRowToView(collection, books);
      });

      return {
        collections: views,
        summary: {
          booksCount: items.length,
          collectionsCount: collections.length,
        },
      };
    },
  );
}

// Reads a single collection by slug. Returns null when not in cache.
export async function readCollectionViewBySlug(
  slug: string,
): Promise<CollectionView | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [db.libraryItems, db.collections, db.collectionMembership],
    async () => {
      const collection = await db.collections.where("slug").equals(slug).first();
      if (!collection) {
        return null;
      }
      const links = await db.collectionMembership
        .where("collectionId")
        .equals(collection.id)
        .toArray();
      const sorted = [...links].sort((a, b) => a.order - b.order);
      const books: LibraryBookView[] = [];
      for (const link of sorted) {
        const row = await db.libraryItems.get(link.libraryItemId);
        if (row) {
          books.push(toBookView(row));
        }
      }
      return collectionRowToView(collection, books);
    },
  );
}

// Replaces the entire library cache with a fresh server payload. We delete
// rows that are no longer present so collections / books removed on another
// device disappear here too. Highlights, books, sessions etc. are untouched —
// they're managed by their own buckets.
export async function applyLibraryPayload(payload: LibraryPayload) {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const libraryItems = new Map<string, LibraryItemRow>();
  const collections: CollectionRow[] = [];
  const memberships: CollectionMembershipRow[] = [];

  for (const collection of payload.collections) {
    collections.push(collectionToRow(collection));
    collection.books.forEach((book, index) => {
      memberships.push({
        collectionId: collection.id,
        libraryItemId: book.libraryItemId,
        order: index,
      });
      // A book may appear in multiple collections — only write the row once.
      // The first encounter wins; subsequent collections share the row.
      if (!libraryItems.has(book.libraryItemId)) {
        libraryItems.set(book.libraryItemId, bookToItemRow(book, nowIso));
      }
    });
  }

  await db.transaction(
    "rw",
    [db.libraryItems, db.collections, db.collectionMembership],
    async () => {
      // Preserve offline-save metadata when rewriting a row. If the user has
      // marked a book savedOffline, we must not stomp that flag from a
      // server payload that doesn't carry it.
      const existing = await db.libraryItems.toArray();
      const existingById = new Map(
        existing.map((row) => [row.libraryItemId, row]),
      );

      const nextItems = Array.from(libraryItems.values()).map((row) => {
        const prior = existingById.get(row.libraryItemId);
        if (!prior) {
          return row;
        }
        return {
          ...row,
          coverBlob: prior.coverBlob,
          savedOffline: prior.savedOffline,
          savedAutomatically: prior.savedAutomatically,
          savedAt: prior.savedAt,
          // A locally-toggled offline intent that hasn't synced yet wins over
          // the server payload; otherwise the server value (already in `row`)
          // stands.
          ...(prior.offlineRequestedDirty
            ? {
                offlineRequested: prior.offlineRequested,
                offlineRequestedDirty: true,
              }
            : {}),
          // Preserve any book-info details already cached. A library list
          // payload doesn't carry these, so re-hydrating from one must not
          // wipe them.
          details: prior.details,
          detailsFetchedAt: prior.detailsFetchedAt,
        } satisfies LibraryItemRow;
      });

      // Replace strategy: clear tables, then bulk-put the fresh data. Cheap
      // for a couple-hundred row library. If it ever stops being cheap we
      // can diff instead.
      await db.libraryItems.clear();
      await db.collections.clear();
      await db.collectionMembership.clear();

      await db.libraryItems.bulkPut(nextItems);
      await db.collections.bulkPut(collections);
      await db.collectionMembership.bulkPut(memberships);
    },
  );
}

// Same as applyLibraryPayload but only touches one collection — used by the
// /app/library/collections/[slug] route so reading a single collection
// page doesn't wipe siblings.
export async function applyCollectionPayload(
  collection: LibraryCollection,
) {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const items = collection.books.map((book) => bookToItemRow(book, nowIso));
  const memberships: CollectionMembershipRow[] = collection.books.map(
    (book, index) => ({
      collectionId: collection.id,
      libraryItemId: book.libraryItemId,
      order: index,
    }),
  );

  await db.transaction(
    "rw",
    [db.libraryItems, db.collections, db.collectionMembership],
    async () => {
      const existing = await db.libraryItems
        .where("libraryItemId")
        .anyOf(items.map((row) => row.libraryItemId))
        .toArray();
      const existingById = new Map(
        existing.map((row) => [row.libraryItemId, row]),
      );
      const merged = items.map((row) => {
        const prior = existingById.get(row.libraryItemId);
        if (!prior) {
          return row;
        }
        return {
          ...row,
          coverBlob: prior.coverBlob,
          savedOffline: prior.savedOffline,
          savedAutomatically: prior.savedAutomatically,
          savedAt: prior.savedAt,
          // A locally-toggled offline intent that hasn't synced yet wins over
          // the server payload; otherwise the server value (already in `row`)
          // stands.
          ...(prior.offlineRequestedDirty
            ? {
                offlineRequested: prior.offlineRequested,
                offlineRequestedDirty: true,
              }
            : {}),
          // Preserve any book-info details already cached. A library list
          // payload doesn't carry these, so re-hydrating from one must not
          // wipe them.
          details: prior.details,
          detailsFetchedAt: prior.detailsFetchedAt,
        } satisfies LibraryItemRow;
      });

      await db.libraryItems.bulkPut(merged);
      await db.collections.put(collectionToRow(collection));
      await db.collectionMembership
        .where("collectionId")
        .equals(collection.id)
        .delete();
      await db.collectionMembership.bulkPut(memberships);
    },
  );
}

// ----- offline-save intent (server-synced) -----------------------------------

// Optimistically toggles the "keep offline" intent on a library row and marks
// it dirty so the sync flush PATCHes it. Returns false if the row isn't cached
// yet (the caller hasn't hydrated the book) — nothing to toggle.
export async function setOfflineRequestedLocal(
  libraryItemId: string,
  requested: boolean,
): Promise<boolean> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row) {
    return false;
  }
  await db.libraryItems.put({
    ...row,
    offlineRequested: requested,
    offlineRequestedDirty: true,
  });
  return true;
}

// Promotes an already-cached (auto-saved) book to an explicit, sticky offline
// save: flips `savedOffline` so the eviction pass stops treating it as the
// evictable auto-slot, and sets the synced `offlineRequested` intent (dirty,
// for the next flush). Content is already on disk, so no download is needed —
// this takes effect immediately, even offline. Returns false if not cached.
export async function markOfflineKeptLocal(
  libraryItemId: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row) {
    return false;
  }
  await db.libraryItems.put({
    ...row,
    savedOffline: true,
    offlineRequested: true,
    offlineRequestedDirty: true,
  });
  return true;
}

// Releases an explicitly-kept book back to an evictable auto-cache WITHOUT
// deleting its content: clears the synced `offlineRequested` intent (dirty, for
// the next flush) and `savedOffline`, and marks it `savedAutomatically` so the
// normal eviction pass can reclaim it later. The chapters/cover stay on disk,
// so it's still readable offline until eviction. Returns false if not cached.
export async function markOfflineReleasedLocal(
  libraryItemId: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row) {
    return false;
  }
  await db.libraryItems.put({
    ...row,
    savedOffline: false,
    savedAutomatically: true,
    offlineRequested: false,
    offlineRequestedDirty: true,
  });
  return true;
}

// Rows with an offline-intent toggle that hasn't reached the server yet.
export async function listOfflineIntentDirty(): Promise<LibraryItemRow[]> {
  const db = getDb();
  return db.libraryItems
    .filter((row) => row.offlineRequestedDirty === true)
    .toArray();
}

// Clears the dirty flag after a successful PATCH — but only if the local value
// still matches what we synced (a newer toggle during the request stays dirty).
export async function markOfflineIntentClean(
  libraryItemId: string,
  syncedValue: boolean,
): Promise<void> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row || row.offlineRequested !== syncedValue) {
    return;
  }
  await db.libraryItems.put({ ...row, offlineRequestedDirty: false });
}

// ----- conversions -----------------------------------------------------------

function bookToItemRow(
  book: LibraryCollectionBook,
  nowIso: string,
): LibraryItemRow {
  return {
    libraryItemId: book.libraryItemId,
    slug: book.slug,
    title: book.title,
    authors: book.authors,
    coverImageUrl: book.coverImageUrl,
    completionPercent: book.completionPercent,
    primaryFormat: book.primaryFormat,
    lastReadAt: book.lastReadAt ?? null,
    offlineRequested: book.offlineRequested ?? false,
    offlineRequestedDirty: false,
    coverBlob: null,
    savedOffline: false,
    savedAutomatically: false,
    savedAt: null,
    serverUpdatedAt: nowIso,
  };
}

function collectionToRow(collection: LibraryCollection): CollectionRow {
  return {
    id: collection.id,
    slug: collection.slug,
    kind: collection.kind,
    name: collection.name,
    description: collection.description,
    smartKey: collection.smartKey,
    itemCount: collection.itemCount,
    unreadCount: collection.unreadCount,
    bookCount: collection.books.length,
    serverUpdatedAt: new Date().toISOString(),
  };
}

// ----- book-info details -----------------------------------------------------
// Cached so the book-info page works offline once the user has visited it
// (online) at least once. The card fields come from a sibling cache (the
// library payload that listed the book); the details delta is layered on top
// of whatever is already in the row, and we never tear down the row if only
// the details endpoint is available.

// Writes the full LibraryBookInfo into the row identified by libraryItemId.
// Used by the book-info page hydrator after either of its server fetches.
export async function applyBookInfoPayload(
  book: LibraryBookInfo,
): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  await db.transaction("rw", db.libraryItems, async () => {
    const prior = await db.libraryItems.get(book.libraryItemId);
    const next: LibraryItemRow = {
      libraryItemId: book.libraryItemId,
      slug: book.slug,
      title: book.title,
      authors: book.authors,
      coverImageUrl: book.coverImageUrl,
      completionPercent: book.completionPercent,
      primaryFormat: book.primaryFormat,
      lastReadAt: book.lastReadAt ?? prior?.lastReadAt ?? null,
      coverBlob: prior?.coverBlob ?? null,
      savedOffline: prior?.savedOffline ?? false,
      savedAutomatically: prior?.savedAutomatically ?? false,
      savedAt: prior?.savedAt ?? null,
      serverUpdatedAt: prior?.serverUpdatedAt ?? nowIso,
      details: {
        addedAt: book.addedAt,
        approximatePageCount: book.approximatePageCount,
        chapterLabel: book.chapterLabel,
        collections: book.collections,
        description: book.description,
        genres: book.genres,
        language: book.language,
        // The details payload's lastReadAt is the strict
        // ReadingProgress.lastReadAt (nullable). The list payload's
        // lastReadAt is the broader "engagement" timestamp. Both have
        // value; we keep the strict one on `details` and the engagement
        // one at the top level (`row.lastReadAt`) so each consumer reads
        // what it expects.
        lastReadAt: book.lastReadAt,
        minutesRead: book.minutesRead,
        publishedYear: book.publishedYear,
        source: book.source,
      },
      detailsFetchedAt: nowIso,
    };
    await db.libraryItems.put(next);
  });
}

// Reads back a full LibraryBookInfo from Dexie. Returns null when either the
// row is missing or details have never been fetched — the page falls back to
// its instructional "open online to download" UX in that case.
export async function readBookInfoBySlug(
  slug: string,
): Promise<LibraryBookInfo | null> {
  const db = getDb();
  const row = await db.libraryItems.where("slug").equals(slug).first();
  if (!row || !row.details) {
    return null;
  }
  return {
    libraryItemId: row.libraryItemId,
    slug: row.slug,
    title: row.title,
    authors: row.authors,
    coverImageUrl: row.coverImageUrl,
    completionPercent: row.completionPercent,
    primaryFormat: row.primaryFormat,
    addedAt: row.details.addedAt,
    approximatePageCount: row.details.approximatePageCount,
    chapterLabel: row.details.chapterLabel,
    collections: row.details.collections,
    description: row.details.description,
    genres: row.details.genres,
    language: row.details.language,
    lastReadAt: row.details.lastReadAt,
    minutesRead: row.details.minutesRead,
    publishedYear: row.details.publishedYear,
    source: row.details.source,
  };
}

function toBookView(row: LibraryItemRow): LibraryBookView {
  return {
    libraryItemId: row.libraryItemId,
    slug: row.slug,
    title: row.title,
    authors: row.authors,
    coverImageUrl: row.coverImageUrl,
    completionPercent: row.completionPercent,
    primaryFormat: row.primaryFormat,
    lastReadAt: row.lastReadAt,
    savedOffline: row.savedOffline,
    offlineRequested: row.offlineRequested ?? false,
  };
}

function collectionRowToView(
  collection: CollectionRow,
  books: LibraryBookView[],
): CollectionView {
  return {
    id: collection.id,
    slug: collection.slug,
    kind: collection.kind,
    name: collection.name,
    description: collection.description,
    smartKey: collection.smartKey,
    itemCount: collection.itemCount,
    unreadCount: collection.unreadCount,
    books,
  };
}
