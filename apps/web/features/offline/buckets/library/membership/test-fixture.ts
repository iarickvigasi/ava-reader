import type { LibraryBookInfo, LibraryBookCollectionsPayload, LibraryCollection } from "@/lib/api-types/library";
import { hydrateBookInfo, hydrateFromPayload } from "../bucket";
import { payload } from "../test-fixture";

export const source = { ...payload().collections[0], unreadCount: 2 };
export const target: LibraryCollection = {
  ...source, id: "col-2", slug: "target", name: "Target", itemCount: 20, unreadCount: 20,
  books: Array.from({ length: 20 }, (_, index) => ({
    ...source.books[1], libraryItemId: `other-${index}`, slug: `other-${index}`,
  })),
};
export const book: LibraryBookInfo = {
  ...source.books[0], collections: [source], addedAt: "2026-01-01T00:00:00Z",
  approximateBodyPageCount: null, approximatePageCount: null, chapterLabel: null,
  description: null, genres: [], language: null, lastReadAt: null, minutesRead: 0,
  publishedYear: null, source: "IMPORTED",
};

export async function seedMembershipFixture() {
  await hydrateFromPayload({
    collections: [source, { ...target, books: target.books.slice(0, 4) }],
    summary: { booksCount: 22, collectionsCount: 2 },
  });
  await hydrateBookInfo(book);
}

export function membershipAck(added: boolean): LibraryBookCollectionsPayload {
  return {
    libraryItemId: book.libraryItemId,
    collections: added ? [source, target] : [source],
    affectedCollections: [{
      ...target, itemCount: added ? 21 : 20, unreadCount: added ? 21 : 20,
      books: added ? [...target.books, source.books[0]] : target.books,
    }],
  };
}

export const token = async () => "token";
export const addTarget = { libraryItemId: book.libraryItemId, addCollectionIds: [target.id], removeCollectionIds: [] };
export const removeTarget = { libraryItemId: book.libraryItemId, addCollectionIds: [], removeCollectionIds: [target.id] };
