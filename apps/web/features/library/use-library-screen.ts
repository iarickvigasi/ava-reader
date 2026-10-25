import type { LibraryCollection, LibraryPayload } from "@/lib/api-types";
import {
  selectUncollectedBooks,
  useLibraryView,
} from "@/features/offline/buckets/library";

export function useLibraryScreen(library: LibraryPayload) {
  const view = useLibraryView();
  const summary = view?.summary ?? library.summary;
  const collections = (view?.collections ?? library.collections).map(
    (collection) =>
      ({
        ...collection,
        books: collection.books.slice(0, 4),
      }) as LibraryCollection,
  );
  const books =
    view?.uncollectedBooks ??
    selectUncollectedBooks(library.books ?? [], library.collections);
  return {
    summary,
    collections,
    books: books as LibraryPayload["books"],
    isEmpty: summary.booksCount === 0 && collections.length === 0,
  };
}
