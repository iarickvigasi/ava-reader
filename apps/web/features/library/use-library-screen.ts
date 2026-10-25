import type { LibraryPayload } from "@/lib/api-types";
import { useLibraryView } from "@/features/offline/buckets/library";
import { useLibraryFilters } from "./use-library-filters";
import { filterLibraryScreen } from "./filter-library-screen";

export function useLibraryScreen(library: LibraryPayload) {
  const view = useLibraryView();
  const { filters, toggle } = useLibraryFilters();
  const summary = view?.summary ?? library.summary;
  const { books, collections } = filterLibraryScreen(library, view, filters);
  return {
    summary,
    collections,
    books,
    filters,
    toggle,
    noMatches:
      filters.length > 0 && books.length === 0 && collections.length === 0,
    isEmpty: summary.booksCount === 0 && collections.length === 0,
  };
}
