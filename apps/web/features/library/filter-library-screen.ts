import type { LibraryCollection, LibraryPayload } from "@/lib/api-types";
import type { LibraryView } from "@/features/offline/buckets/library";
import { selectUncollectedBooks } from "@/features/offline/buckets/library";
import {
  matchesLibraryFilters,
  type LibraryFilter,
  type FilterBook,
} from "./library-filters";
import { isFinished } from "@/features/offline/completion/counts";

export function filterLibraryScreen(
  library: LibraryPayload,
  view: LibraryView | null,
  filters: LibraryFilter[],
) {
  const allBooks = view?.books ?? library.books ?? [];
  const byId = new Map(allBooks.map((book) => [book.libraryItemId, book]));
  const matches = (book: FilterBook) => matchesLibraryFilters(book, filters);
  const general =
    view?.uncollectedBooks ??
    selectUncollectedBooks<(typeof allBooks)[number]>(
      allBooks,
      library.collections,
    );
  const collections = (view?.collections ?? library.collections)
    .map((collection) => {
      const members = view
        ? collection.books
        : collection.completionItems
          ? collection.completionItems.flatMap((item) => {
              const book = byId.get(item.libraryItemId);
              return book ? [book] : [];
            })
          : collection.books;
      const books = members.filter(matches);
      return {
        ...collection,
        ...(filters.length
          ? {
              itemCount: books.length,
              unreadCount: books.filter((book) => !isFinished(book)).length,
            }
          : {}),
        books,
      } as LibraryCollection;
    })
    .filter((collection) => !filters.length || collection.itemCount > 0);
  return {
    collections,
    books: general.filter(matches) as NonNullable<LibraryPayload["books"]>,
  };
}
