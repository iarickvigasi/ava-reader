// Server payload → Dexie row shapes. Pure mapping: no merging (item-row.ts)
// and no I/O (write-library.ts), so the write paths read as collect → merge →
// write.

import type {
  LibraryCollection,
  LibraryCollectionBook,
  LibraryPayload,
} from "@/lib/api-types/library";

import type {
  CollectionMembershipRow,
  CollectionRow,
  LibraryItemRow,
} from "../../../db";

// Everything a whole-library payload writes, flattened out of its collections.
export function collectPayloadRows(payload: LibraryPayload, nowIso: string) {
  const items = new Map<string, LibraryItemRow>();
  const collections: CollectionRow[] = [];
  const memberships: CollectionMembershipRow[] = [];

  for (const collection of payload.collections) {
    collections.push(collectionToRow(collection));
    memberships.push(...membershipRows(collection));
    for (const book of collection.books) {
      // A book may appear in multiple collections — only write the row once.
      // The first encounter wins; subsequent collections share the row.
      if (!items.has(book.libraryItemId)) {
        items.set(book.libraryItemId, bookToItemRow(book, nowIso));
      }
    }
  }

  return { collections, items: Array.from(items.values()), memberships };
}

// Position in the payload is the display order.
export function membershipRows(
  collection: LibraryCollection,
): CollectionMembershipRow[] {
  return collection.books.map((book, index) => ({
    collectionId: collection.id,
    libraryItemId: book.libraryItemId,
    order: index,
  }));
}

export function collectionToRow(collection: LibraryCollection): CollectionRow {
  return {
    id: collection.id,
    slug: collection.slug,
    kind: collection.kind,
    name: collection.name,
    description: collection.description,
    smartKey: collection.smartKey,
    itemCount: collection.itemCount,
    unreadCount: collection.unreadCount,
    completionItems: collection.completionItems,
    bookCount: collection.books.length,
    serverUpdatedAt: new Date().toISOString(),
  };
}

export function bookToItemRow(
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
    ...(book.finishedAt !== undefined ? { finishedAt: book.finishedAt } : {}),
    primaryFormat: book.primaryFormat,
    lastReadAt: book.lastReadAt ?? null,
    offlineRequested: book.offlineRequested ?? false,
    offlineRequestedBaseline: book.offlineRequested ?? false,
    offlineRequestedDirty: false,
    coverBlob: null,
    savedOffline: false,
    savedAutomatically: false,
    savedAt: null,
    serverUpdatedAt: nowIso,
  };
}
