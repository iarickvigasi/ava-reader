import type { LibraryBookView, LibraryView } from "../buckets/library/types";

// Collects the unique books that belong to the default smart collections
// (`kind === "SMART"`). By design every book lands in exactly one of those
// collections, so this is the whole library with custom-collection duplicates
// removed. First-seen order is preserved (imported before catalog, per the
// collections' sortOrder).
export function collectSmartBooks(view: LibraryView): LibraryBookView[] {
  const seen = new Set<string>();
  const out: LibraryBookView[] = [];
  for (const collection of view.collections) {
    if (collection.kind !== "SMART") {
      continue;
    }
    for (const book of collection.books) {
      if (seen.has(book.libraryItemId)) {
        continue;
      }
      seen.add(book.libraryItemId);
      out.push(book);
    }
  }
  return out;
}
