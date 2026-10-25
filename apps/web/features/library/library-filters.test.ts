import { describe, expect, it } from "vitest";
import {
  matchesLibraryFilters,
  parseLibraryFilters,
  type FilterBook,
  type LibraryFilter,
} from "./library-filters";

const book: FilterBook = {
  completionPercent: 0,
  source: "CATALOG",
  hasReadableEdition: true,
};
const states: LibraryFilter[] = ["not-started", "in-progress", "done"];
describe("Library filters", () => {
  it.each([
    [0, null, "not-started"],
    [1, null, "in-progress"],
    [99, null, "in-progress"],
    [100, null, "done"],
    [0, "2026-10-25", "done"],
    [50, "2026-10-25", "done"],
    [100, "2026-10-25", "done"],
  ] as const)(
    "assigns %s%% with finish date %s only to %s",
    (completionPercent, finishedAt, expected) => {
      expect(
        states.filter((state) =>
          matchesLibraryFilters(
            {
              ...book,
              completionPercent: Number(completionPercent),
              finishedAt,
            },
            [state],
          ),
        ),
      ).toEqual([expected]);
    },
  );
  it("ORs sources and states but ANDs groups and actual offline content", () => {
    const filters: LibraryFilter[] = [
      "imported",
      "public-domain",
      "in-progress",
      "done",
      "offline",
    ];
    expect(
      matchesLibraryFilters(
        { ...book, completionPercent: 50, availableOffline: true },
        filters,
      ),
    ).toBe(true);
    expect(
      matchesLibraryFilters(
        {
          ...book,
          source: "IMPORTED",
          finishedAt: "2026-10-25",
          availableOffline: true,
        },
        filters,
      ),
    ).toBe(true);
    expect(
      matchesLibraryFilters(
        { ...book, completionPercent: 50, ...{ offlineRequested: true } },
        filters,
      ),
    ).toBe(false);
    expect(
      matchesLibraryFilters({ ...book, availableOffline: true }, filters),
    ).toBe(false);
  });
  it("reserves Wish list for catalog books explicitly lacking a readable edition", () => {
    expect(
      matchesLibraryFilters({ ...book, hasReadableEdition: false }, [
        "wish-list",
      ]),
    ).toBe(true);
    expect(matchesLibraryFilters(book, ["wish-list"])).toBe(false);
    expect(
      matchesLibraryFilters({ ...book, source: undefined }, ["public-domain"]),
    ).toBe(false);
    expect(matchesLibraryFilters({ ...book, source: undefined }, [])).toBe(
      true,
    );
  });
  it("parses only supported filters, deduplicated in display order", () => {
    expect(
      parseLibraryFilters("?q=x&filters=done,unknown,offline,done"),
    ).toEqual(["offline", "done"]);
  });
});
