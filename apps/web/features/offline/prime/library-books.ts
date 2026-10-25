import type { LibraryBookView, LibraryView } from "../buckets/library";

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
  return view.books.filter(
    (b) => b.offlineRequested || b.libraryItemId === currentBookId,
  );
}
