// Converts a Dexie CollectionView into the LibraryCollection payload shape the
// collection screen expects as its initial prop. Used by the generic-shell
// collection loader (ADR 4) — the screen itself keeps live via
// useCollectionView and its own internal merge.

import type { BookFileFormat, LibraryCollection } from "@/lib/api-types";

import type { CollectionView } from "../types";

export function collectionViewToLibraryCollection(
  view: CollectionView,
): LibraryCollection {
  return {
    id: view.id,
    slug: view.slug,
    kind: view.kind,
    name: view.name,
    description: view.description,
    smartKey: view.smartKey,
    itemCount: view.itemCount,
    unreadCount: view.unreadCount,
    books: view.books.map((book) => ({
      libraryItemId: book.libraryItemId,
      slug: book.slug,
      title: book.title,
      authors: book.authors,
      coverImageUrl: book.coverImageUrl,
      completionPercent: book.completionPercent,
      ...(book.finishedAt !== undefined ? { finishedAt: book.finishedAt } : {}),
      // Stored as plain string in Dexie; values were always written from the
      // BookFileFormat union, so the cast is sound.
      primaryFormat: book.primaryFormat as BookFileFormat,
      lastReadAt: book.lastReadAt ?? "",
    })),
  };
}
