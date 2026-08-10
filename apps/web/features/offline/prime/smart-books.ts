import type { LibraryBookView, LibraryView } from "../buckets/library/types";

// Collects the unique books that belong to the default smart collections
// (`kind === "SMART"`). Every book lands in exactly one of the two *source*
// shelves (imported / catalog), so this is the whole library with duplicates
// removed — the third shelf, Offline Books, is a subset of those two and adds
// nothing new past the `seen` filter. First-seen order is preserved (imported,
// then catalog, then offline, per the collections' sortOrder).
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

// The content-tier targets: books the user marked offline, plus the current
// continue-reading book when `currentBookId` is passed (null when caching it
// isn't allowed, or there's none). Shared by the content pass (prime-content)
// and the reconcile probe (outstanding) so the predicate lives in one place. A
// `currentBookId` not in the library naturally drops out — we only ever return
// real library books.
export function collectContentTargets(
  view: LibraryView,
  currentBookId: string | null,
): LibraryBookView[] {
  return collectSmartBooks(view).filter(
    (b) => b.offlineRequested || b.libraryItemId === currentBookId,
  );
}
