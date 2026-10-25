import type { LibraryCardBook } from "@/lib/api-types/library-catalog";
import { isFinished } from "@/features/offline/completion/counts";

export const SOURCE_FILTERS = [
  "imported",
  "public-domain",
  "wish-list",
] as const;
export const PROGRESS_FILTERS = ["in-progress", "done", "not-started"] as const;
export const LIBRARY_FILTERS = [
  "offline",
  ...SOURCE_FILTERS,
  ...PROGRESS_FILTERS,
] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];
export type FilterBook = Pick<
  LibraryCardBook,
  "source" | "hasReadableEdition" | "completionPercent" | "finishedAt"
> & { availableOffline?: boolean };

export function parseLibraryFilters(search: string): LibraryFilter[] {
  const values = new URLSearchParams(search).get("filters")?.split(",") ?? [];
  return LIBRARY_FILTERS.filter((filter) => values.includes(filter));
}

export function matchesLibraryFilters(
  book: FilterBook,
  filters: LibraryFilter[],
): boolean {
  const finished = isFinished(book);
  const matches: Record<LibraryFilter, boolean> = {
    offline: book.availableOffline === true,
    imported: book.source === "IMPORTED",
    "public-domain":
      book.source === "CATALOG" && book.hasReadableEdition !== false,
    "wish-list": book.source === "CATALOG" && book.hasReadableEdition === false,
    done: finished,
    "in-progress":
      !finished && book.completionPercent > 0 && book.completionPercent < 100,
    "not-started": !finished && book.completionPercent === 0,
  };
  const groupMatches = (group: readonly LibraryFilter[]) => {
    const selected = filters.filter((filter) => group.includes(filter));
    return selected.length === 0 || selected.some((filter) => matches[filter]);
  };
  return (
    (!filters.includes("offline") || matches.offline) &&
    groupMatches(SOURCE_FILTERS) &&
    groupMatches(PROGRESS_FILTERS)
  );
}
