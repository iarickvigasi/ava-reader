// Dexie I/O for the home-screen cache. Single row keyed by "me". Cached so
// the dashboard renders when the app is opened or reloaded offline.

import type { HomePayload } from "@/lib/api-types/home";

import { getDb } from "../../db";
import {
  completionTables,
  composeCollectionCounts,
  composeCompletedCount,
  readCompletionContext,
} from "../../completion/counts";
import { composeHomeReading } from "../../stats/compose-home-reading";
import { readCollectionPickerOptions, readLibraryView } from "../library";

export async function readHome(): Promise<HomePayload | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [
      db.home,
      db.sessions,
      ...completionTables(db),
      db.collections,
      db.collectionMembership,
    ],
    async () => {
      const row = await db.home.get("me");
      if (!row) return null;
      const revision = row.completionRevision ?? 0;
      const context = await readCompletionContext(db);
      let payload = composeHomeReading(
        row.payload,
        await db.sessions.toArray(),
      );
      if (payload.completionItems !== undefined) {
        payload = {
          ...payload,
          stats: {
            ...payload.stats,
            volumesRead: composeCompletedCount(
              payload.completionItems,
              revision,
              context,
            ),
          },
        };
      }
      if (
        payload.collections?.items.some(
          (collection) => collection.completionItems !== undefined,
        )
      ) {
        return {
          ...payload,
          collections: {
            items: payload.collections.items.map((collection) => ({
              ...collection,
              ...composeCollectionCounts(
                { ...collection, completionRevision: revision },
                context,
              ),
            })),
          },
        };
      }
      if ((await db.collectionMembershipMutations.count()) === 0)
        return payload;
      // Old cached home payloads have no complete membership/status snapshot.
      // Retain their prior membership fallback without replacing newer home
      // aggregates that carry their own complete completion metadata.
      if ((await readCollectionPickerOptions()) === null) return payload;
      const library = await readLibraryView();
      if (!library) return payload;
      return {
        ...payload,
        collections: {
          items: library.collections.slice(0, 6).map((collection) => ({
            id: collection.id,
            slug: collection.slug,
            name: collection.name,
            description: collection.description,
            kind: collection.kind,
            smartKey: collection.smartKey,
            itemCount: collection.itemCount,
            unreadCount: collection.unreadCount,
          })),
        },
      };
    },
  );
}
