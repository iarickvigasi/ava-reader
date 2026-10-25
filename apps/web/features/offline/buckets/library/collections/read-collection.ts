import { getDb } from "../../../db";
import {
  completionTables,
  composeCollectionCounts,
  readCompletionContext,
} from "../../../completion/counts";
import {
  buildMembershipCollectionView,
  buildOfflineShelfView,
} from "./collection-view";
import { overlayCollectionMembership } from "../membership/selectors";
import { isOfflineBooksCollection } from "@/lib/smart-collections";
import type { CollectionView } from "../types";

// Reads a single collection by slug. Returns null when not in cache.
export async function readCollectionViewBySlug(
  slug: string,
): Promise<CollectionView | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [...completionTables(db), db.collections, db.collectionMembership],
    async () => {
      const collection = await db.collections
        .where("slug")
        .equals(slug)
        .first();
      if (!collection) {
        return null;
      }
      const completion = await readCompletionContext(db);
      // The derived shelf is evaluated against every cached row; a normal
      // collection loads only the rows its membership names.
      if (isOfflineBooksCollection(collection)) {
        const rows = [...completion.items.values()];
        const view = buildOfflineShelfView(collection, rows);
        return collection.completionItems
          ? { ...view, ...composeCollectionCounts(collection, completion) }
          : view;
      }
      const links = await db.collectionMembership
        .where("collectionId")
        .equals(collection.id)
        .toArray();
      const items = [...completion.items.values()];
      const mutations = [...completion.memberships.values()];
      const overlaid = overlayCollectionMembership(
        collection,
        items,
        links,
        mutations,
      );
      const view = buildMembershipCollectionView(
        overlaid.collection,
        items,
        overlaid.links,
      );
      return collection.completionItems
        ? { ...view, ...composeCollectionCounts(collection, completion) }
        : view;
    },
  );
}
