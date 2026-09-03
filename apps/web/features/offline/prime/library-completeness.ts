// Decides whether the primer's per-collection pass actually cached the whole
// library, and if so which item ids it saw. This is the gate on pruning: only
// a complete pass can prove a book absent ([[4-offline/_overview]], Write
// paths), and `revalidate*` swallow network errors, so finishing the loop is
// not proof — a collection holding fewer books than its own `itemCount` means
// a fetch quietly failed, and pruning then would delete live books.
//
// The Offline Books shelf is exempt: it is derived from local rows, so its
// books are what this device has while its itemCount is the server's total
// ([[4.8-offline-books-collection]]). It never satisfies the check and lists
// nothing the source shelves don't already carry.

import { isOfflineBooksCollection } from "@/lib/smart-collections";

import type { LibraryView } from "../buckets/library/types";

export function collectCompleteLibraryIds(view: LibraryView): string[] | null {
  const judged = view.collections.filter(
    (collection) => !isOfflineBooksCollection(collection),
  );
  if (judged.length === 0) {
    return null;
  }
  const ids = new Set<string>();
  for (const collection of judged) {
    if (collection.books.length < collection.itemCount) {
      return null;
    }
    for (const book of collection.books) {
      ids.add(book.libraryItemId);
    }
  }
  return [...ids];
}
