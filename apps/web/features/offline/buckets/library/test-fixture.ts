// Library payloads shared by the bucket's Dexie tests: one plain custom
// collection, and the same books under the derived Offline Books shelf.

import type { LibraryPayload } from "@/lib/api-types/library";

export function payload(): LibraryPayload {
  return {
    summary: { booksCount: 2, collectionsCount: 1 },
    collections: [
      {
        id: "col-1",
        slug: "favs",
        kind: "CUSTOM",
        name: "Favorites",
        description: null,
        smartKey: null,
        itemCount: 2,
        unreadCount: 1,
        books: [
          {
            libraryItemId: "lib-1",
            slug: "book-a",
            title: "Book A",
            authors: ["A"],
            coverImageUrl: null,
            completionPercent: 10,
            primaryFormat: "EPUB",
            lastReadAt: "2026-01-01T00:00:00Z",
          },
          {
            libraryItemId: "lib-2",
            slug: "book-b",
            title: "Book B",
            authors: ["B"],
            coverImageUrl: null,
            completionPercent: 0,
            primaryFormat: "EPUB",
            lastReadAt: "2026-01-02T00:00:00Z",
          },
        ],
      },
    ],
  };
}

// A payload as the server sends it: the offline shelf carries the membership
// that was true at sync time. The read layer deliberately ignores those rows and
// derives from `offlineRequested` instead — see spec 4.8.
export function offlineShelfPayload(): LibraryPayload {
  const [bookA, bookB] = payload().collections[0].books;
  return {
    summary: { booksCount: 2, collectionsCount: 2 },
    collections: [
      {
        ...payload().collections[0],
        books: [
          { ...bookA, offlineRequested: true },
          { ...bookB, offlineRequested: false },
        ],
      },
      {
        id: "col-offline",
        slug: "offline-books",
        kind: "SMART",
        name: "Offline Books",
        description: "Books you've saved to read without a connection.",
        smartKey: "offline-books",
        itemCount: 1,
        unreadCount: 1,
        books: [{ ...bookA, offlineRequested: true }],
      },
    ],
  };
}
