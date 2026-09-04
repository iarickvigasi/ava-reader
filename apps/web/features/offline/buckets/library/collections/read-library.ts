// Dexie read paths for the library screen: the whole library, or one
// collection by slug. The bucket's in-memory state is what components actually
// read; this is the slow path used during hydration + revalidation only.

import { isOfflineBooksCollection } from "@/lib/smart-collections";

import {
  buildCollectionView,
  buildMembershipCollectionView,
  buildOfflineShelfView,
} from "./collection-view";
import { compareCollectionViews } from "./compare-collections";
import { groupMembershipByCollection } from "./membership-index";
import { readLibraryBooksCountTx } from "./summary-store";
import type { CollectionView, LibraryView } from "../types";

import { getDb } from "../../../db";

// Reads everything we need to render the library screen in one transaction.
// Returns null when the DB is empty — caller treats that as "never hydrated"
// and falls back to the SSR/RSC payload it was given.
export async function readLibraryView(): Promise<LibraryView | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [db.libraryItems, db.collections, db.collectionMembership, db.meta],
    async () => {
      const collections = await db.collections.toArray();
      if (collections.length === 0) {
        return null;
      }
      const items = await db.libraryItems.toArray();
      const byCollection = groupMembershipByCollection(
        await db.collectionMembership.toArray(),
      );

      const views = collections
        .map((collection) =>
          buildCollectionView(
            collection,
            items,
            byCollection.get(collection.id) ?? [],
          ),
        )
        // Dexie returns rows in primary-key order; display order is computed
        // here (docs/specs/3-library/3.1-library-screen.md §3).
        .sort(compareCollectionViews);

      // Falls back to the rows on hand when nothing is stored yet (a cache
      // seeded only by a collection page), rather than to zero.
      const storedBooksCount = await readLibraryBooksCountTx();

      return {
        collections: views,
        summary: {
          booksCount: storedBooksCount ?? items.length,
          collectionsCount: collections.length,
        },
      };
    },
  );
}

// Reads a single collection by slug. Returns null when not in cache.
export async function readCollectionViewBySlug(
  slug: string,
): Promise<CollectionView | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [db.libraryItems, db.collections, db.collectionMembership],
    async () => {
      const collection = await db.collections
        .where("slug")
        .equals(slug)
        .first();
      if (!collection) {
        return null;
      }
      // The derived shelf is evaluated against every cached row; a normal
      // collection loads only the rows its membership names.
      if (isOfflineBooksCollection(collection)) {
        const rows = await db.libraryItems.toArray();
        return buildOfflineShelfView(collection, rows);
      }
      const links = await db.collectionMembership
        .where("collectionId")
        .equals(collection.id)
        .toArray();
      const items = await db.libraryItems
        .where("libraryItemId")
        .anyOf(links.map((link) => link.libraryItemId))
        .toArray();
      return buildMembershipCollectionView(collection, items, links);
    },
  );
}
