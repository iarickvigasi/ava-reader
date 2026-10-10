import type { LibraryView } from "./types";

export function viewsEqual(
  a: LibraryView | null,
  b: LibraryView | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.summary.booksCount !== b.summary.booksCount) return false;
  if (a.summary.collectionsCount !== b.summary.collectionsCount) return false;
  if (a.collections.length !== b.collections.length) return false;
  for (let i = 0; i < a.collections.length; i += 1) {
    const ca = a.collections[i];
    const cb = b.collections[i];
    if (ca.id !== cb.id) return false;
    if (ca.name !== cb.name) return false;
    if (ca.description !== cb.description) return false;
    if (ca.unreadCount !== cb.unreadCount) return false;
    if (ca.itemCount !== cb.itemCount) return false;
    if (ca.books.length !== cb.books.length) return false;
    for (let j = 0; j < ca.books.length; j += 1) {
      const ba = ca.books[j];
      const bb = cb.books[j];
      if (ba.libraryItemId !== bb.libraryItemId) return false;
      if (ba.title !== bb.title || ba.coverImageUrl !== bb.coverImageUrl)
        return false;
      if (JSON.stringify(ba.pdfImport) !== JSON.stringify(bb.pdfImport))
        return false;
      if (ba.completionPercent !== bb.completionPercent) return false;
      if (ba.finishedAt !== bb.finishedAt) return false;
      if (ba.lastReadAt !== bb.lastReadAt) return false;
      if (ba.savedOffline !== bb.savedOffline) return false;
    }
  }
  return true;
}
