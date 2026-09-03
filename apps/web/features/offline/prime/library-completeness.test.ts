import { describe, expect, it } from "vitest";

import type { CollectionView, LibraryBookView, LibraryView } from "../buckets/library/types";

import { collectCompleteLibraryIds } from "./library-completeness";

function book(id: string): LibraryBookView {
  return {
    libraryItemId: id,
    slug: id,
    title: id,
    authors: [],
    coverImageUrl: null,
    completionPercent: 0,
    primaryFormat: "EPUB",
    lastReadAt: null,
    savedOffline: false,
    offlineRequested: false,
  };
}

function collection(
  over: Partial<CollectionView> & { id: string; books: LibraryBookView[] },
): CollectionView {
  return {
    id: over.id,
    slug: over.slug ?? over.id,
    name: over.id,
    description: null,
    kind: over.kind ?? "SMART",
    smartKey: over.smartKey ?? "imported-library",
    itemCount: over.itemCount ?? over.books.length,
    unreadCount: 0,
    books: over.books,
  };
}

function view(collections: CollectionView[]): LibraryView {
  return { collections, summary: { booksCount: 0, collectionsCount: collections.length } };
}

describe("collectCompleteLibraryIds", () => {
  it("returns the union of ids when every collection is fully cached", () => {
    const ids = collectCompleteLibraryIds(
      view([
        collection({ id: "c1", books: [book("a"), book("b")] }),
        collection({ id: "c2", kind: "CUSTOM", smartKey: null, books: [book("b")] }),
      ]),
    );

    expect(ids).toEqual(["a", "b"]);
  });

  // `revalidate*` swallow network errors, so a finished hydration loop does not
  // prove the data landed. A short collection is the tell — and pruning on it
  // would delete books that merely failed to fetch.
  it("returns null when a collection holds fewer books than it claims", () => {
    const ids = collectCompleteLibraryIds(
      view([collection({ id: "c1", itemCount: 50, books: [book("a")] })]),
    );

    expect(ids).toBeNull();
  });

  // The Offline Books shelf is derived from local rows, not membership: its
  // itemCount is the server's whole-shelf total while its books are only what
  // this device has. It can never satisfy the check, so it is exempt.
  it("ignores the offline-books shelf when judging completeness", () => {
    const ids = collectCompleteLibraryIds(
      view([
        collection({ id: "c1", books: [book("a")] }),
        collection({
          id: "c2",
          smartKey: "offline-books",
          itemCount: 10,
          books: [book("a")],
        }),
      ]),
    );

    expect(ids).toEqual(["a"]);
  });

  it("returns null for an empty view rather than an empty keep set", () => {
    expect(collectCompleteLibraryIds(view([]))).toBeNull();
  });
});
