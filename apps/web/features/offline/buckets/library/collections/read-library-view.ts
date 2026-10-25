import { readCatalogIds } from "./catalog-store";
import { selectUncollectedRows } from "./uncollected-books";
// Dexie read paths for the library screen: the whole library, or one
// collection by slug. The bucket's in-memory state is what components actually
// read; this is the slow path used during hydration + revalidation only.

import { buildCollectionView, toBookView } from "./collection-view";
import { compareCollectionViews } from "./compare-collections";
import { groupMembershipByCollection } from "./membership-index";
import { readLibraryBooksCountTx } from "./summary-store";
import type { LibraryView } from "../types";
import { overlayCollectionMembership } from "../membership/selectors";

import { getDb } from "../../../db";
import {
  completionTables,
  composeCollectionCounts,
  readCompletionContext,
} from "../../../completion/counts";

// Reads everything we need to render the library screen in one transaction.
// Returns null when the DB is empty — caller treats that as "never hydrated"
// and falls back to the SSR/RSC payload it was given.
export async function readLibraryView(): Promise<LibraryView | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [...completionTables(db), db.collections, db.collectionMembership],
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

      const views = collections
        .map((collection) => {
          const overlaid = overlayCollectionMembership(
            collection,
            items,
            byCollection.get(collection.id) ?? [],
            mutations,
          );
          const view = buildCollectionView(
            overlaid.collection,
            items,
            overlaid.links,
          );
          return collection.completionItems
            ? { ...view, ...composeCollectionCounts(collection, completion) }
            : view;
        })
        // Dexie returns rows in primary-key order; display order is computed
        // here (docs/specs/3-library/3.1-library-screen.md §3).
        .sort(compareCollectionViews);

      // Falls back to the rows on hand when nothing is stored yet (a cache
      // seeded only by a collection page), rather than to zero.
      const orderedItems = [...items].sort(
        (a, b) =>
          Date.parse(b.lastReadAt ?? "") - Date.parse(a.lastReadAt ?? ""),
      );
      return {
        books: orderedItems.map(toBookView),
        uncollectedBooks: selectUncollectedRows(
          orderedItems,
          collections,
          [...byCollection.values()].flat(),
          mutations,
        ).map(toBookView),
        collections: views,
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
