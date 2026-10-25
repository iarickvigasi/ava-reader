import { enrichFilterBooks } from "./filter-book-views";
import { readCatalogRevision, readCatalogIds } from "./catalog-store";
import { selectUncollectedRows } from "./uncollected-books";
// Dexie read paths for the library screen: the whole library, or one
// collection by slug. The bucket's in-memory state is what components actually
// read; this is the slow path used during hydration + revalidation only.

import { composeLibraryCollections } from "./compose-library-collections";
import { toBookView } from "./collection-view";
import { groupMembershipByCollection } from "./membership-index";
import { readLibraryBooksCountTx } from "./summary-store";
import type { LibraryView } from "../types";

import { getDb } from "../../../db";
import {
  completionTables,
  readCompletionContext,
} from "../../../completion/counts";

// Reads everything we need to render the library screen in one transaction.
// Returns null when the DB is empty — caller treats that as "never hydrated"
// and falls back to the SSR/RSC payload it was given.
export async function readLibraryView(): Promise<LibraryView | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [
      ...completionTables(db),
      db.collections,
      db.collectionMembership,
      db.books,
      db.bookChapters,
    ],
    async () => {
      const collections = await db.collections.toArray();
      const storedBooksCount = await readLibraryBooksCountTx();
      const completion = await readCompletionContext(db);
      if (
        collections.length === 0 &&
        storedBooksCount === null &&
        completion.items.size === 0
      )
        return null;
      const catalogIds = await readCatalogIds();
      const activeIds = catalogIds ? new Set(catalogIds) : undefined;
      const items = [...completion.items.values()].filter(
        (item) => !activeIds || activeIds.has(item.libraryItemId),
      );
      const mutations = [...completion.memberships.values()];
      const byCollection = groupMembershipByCollection(
        await db.collectionMembership.toArray(),
      );

      const views = composeLibraryCollections(
        collections,
        items,
        byCollection,
        completion,
      );

      // Falls back to the rows on hand when nothing is stored yet (a cache
      // seeded only by a collection page), rather than to zero.
      const orderedItems = [...items].sort(
        (a, b) =>
          Date.parse(b.lastReadAt ?? "") - Date.parse(a.lastReadAt ?? ""),
      );
      const books = await enrichFilterBooks(
        db,
        orderedItems.map(toBookView),
        completion,
        await readCatalogRevision(),
      );
      const bookMap = new Map(books.map((book) => [book.libraryItemId, book]));
      const resolve = (id: string) => bookMap.get(id)!;
      return {
        books,
        uncollectedBooks: selectUncollectedRows(
          orderedItems,
          collections,
          [...byCollection.values()].flat(),
          mutations,
        ).map((row) => resolve(row.libraryItemId)),
        collections: views.map((collection) => ({
          ...collection,
          books: collection.books.map((book) => resolve(book.libraryItemId)),
        })),
        summary: {
          booksCount:
            catalogIds !== undefined
              ? items.length
              : (storedBooksCount ?? items.length),
          collectionsCount: collections.length,
        },
      };
    },
  );
}
