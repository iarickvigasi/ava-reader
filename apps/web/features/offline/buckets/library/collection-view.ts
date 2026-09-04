// Rows → CollectionView: what the library and collection screens render. Both
// read paths (read-library.ts) map through here so the Offline Books special
// case, the membership ordering and the counts have one definition. They keep
// their own loading strategies, though: the derived shelf needs every cached
// row, a normal collection only its own members.

import { isOfflineBooksCollection } from "@/lib/smart-collections";

import {
  resolveOfflineCounts,
  selectOfflineBookRows,
} from "./offline-books-view";
import type { CollectionView, LibraryBookView } from "./types";

import type {
  CollectionMembershipRow,
  CollectionRow,
  LibraryItemRow,
} from "../../db";

// For callers holding the whole cache already; `items` covers both branches.
export function buildCollectionView(
  collection: CollectionRow,
  items: LibraryItemRow[],
  links: CollectionMembershipRow[],
): CollectionView {
  if (isOfflineBooksCollection(collection)) {
    return buildOfflineShelfView(collection, items);
  }
  return buildMembershipCollectionView(collection, items, links);
}

// The Offline Books shelf is derived from every cached row rather than from
// membership, and carries locally-adjusted counts (offline-books-view.ts).
export function buildOfflineShelfView(
  collection: CollectionRow,
  allItems: LibraryItemRow[],
): CollectionView {
  return collectionRowToView(
    collection,
    selectOfflineBookRows(allItems).map(toBookView),
    resolveOfflineCounts(collection, allItems),
  );
}

// Membership order is the display order — Dexie returns rows in key order.
// Links without a cached row are skipped: the row may not be primed yet.
export function buildMembershipCollectionView(
  collection: CollectionRow,
  items: LibraryItemRow[],
  links: CollectionMembershipRow[],
): CollectionView {
  const itemsById = new Map(items.map((row) => [row.libraryItemId, row]));
  const books: LibraryBookView[] = [];
  for (const link of [...links].sort((a, b) => a.order - b.order)) {
    const row = itemsById.get(link.libraryItemId);
    if (row) {
      books.push(toBookView(row));
    }
  }
  return collectionRowToView(collection, books);
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
  // Defaults to the server's counts; the Offline Books shelf passes its own,
  // since its membership is evaluated locally (offline-books-view.ts).
  counts: { itemCount: number; unreadCount: number } = {
    itemCount: collection.itemCount,
    unreadCount: collection.unreadCount,
  },
): CollectionView {
  return {
    id: collection.id,
    slug: collection.slug,
    kind: collection.kind,
    name: collection.name,
    description: collection.description,
    smartKey: collection.smartKey,
    ...counts,
    books,
  };
}
