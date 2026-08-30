import { describe, expect, it } from "vitest";

import { compareCollectionViews } from "./compare-collections";
import type { CollectionView, LibraryBookView } from "./types";

function book(lastReadAt: string | null): LibraryBookView {
  return {
    libraryItemId: `item-${lastReadAt ?? "none"}`,
    slug: "slug",
    title: "Title",
    authors: [],
    coverImageUrl: null,
    completionPercent: 0,
    primaryFormat: "EPUB",
    lastReadAt,
    savedOffline: false,
    offlineRequested: false,
  };
}

function view(
  name: string,
  itemCount: number,
  lastReadAt: string | null,
): CollectionView {
  return {
    id: name,
    slug: name,
    kind: "CUSTOM",
    name,
    description: null,
    smartKey: null,
    itemCount,
    unreadCount: 0,
    books: lastReadAt === null ? [] : [book(lastReadAt)],
  };
}

function order(views: CollectionView[]): string[] {
  return [...views].sort(compareCollectionViews).map((entry) => entry.name);
}

describe("compareCollectionViews", () => {
  it("mirrors the server rule: recency, then fewest items, empty last", () => {
    const justOpened = "2026-08-30T09:00:00.000Z";

    expect(
      order([
        view("Imported Books", 100, justOpened),
        view("Empty Shelf", 0, null),
        view("Stale Shelf", 40, "2020-01-01T00:00:00.000Z"),
        view("Offline Books", 20, justOpened),
        view("Sci-fi", 5, justOpened),
      ]),
    ).toEqual([
      "Sci-fi",
      "Offline Books",
      "Imported Books",
      "Stale Shelf",
      "Empty Shelf",
    ]);
  });

  it("falls back to name when nothing else separates two shelves", () => {
    expect(order([view("Zeta", 0, null), view("Delta", 0, null)])).toEqual([
      "Delta",
      "Zeta",
    ]);
  });

  it("treats an unparseable timestamp as never engaged rather than throwing", () => {
    expect(
      order([view("Broken", 2, "not-a-date"), view("Real", 2, "2026-08-30T09:00:00.000Z")]),
    ).toEqual(["Real", "Broken"]);
  });
});
