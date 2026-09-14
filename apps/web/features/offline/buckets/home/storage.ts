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
import { readCompletionRevision, type CompletionWriteOptions } from "../../completion/state";
import { readCollectionPickerOptions, readLibraryView } from "../library";

export async function applyHome(
  payload: HomePayload,
  options: CompletionWriteOptions = {},
): Promise<void> {
  const db = options.db ?? getDb();
  if (db !== getDb()) return;
  await db.transaction("rw", [db.home, db.meta], async () => {
    if (db !== getDb()) return;
    if (options.expectedCompletionRevision !== undefined &&
      options.expectedCompletionRevision !== await readCompletionRevision(db)) return;
    if (options.seedOnly && await db.home.get("me")) return;
    await db.home.put({
      id: "me", payload, fetchedAt: new Date().toISOString(),
      // An RSC/cache-loader payload has no trustworthy local request revision.
      completionRevision: options.expectedCompletionRevision ?? 0,
    });
  });
}

export async function readHome(): Promise<HomePayload | null> {
  const db = getDb();
  return db.transaction("r", [db.home, ...completionTables(db), db.collections, db.collectionMembership], async () => {
    const row = await db.home.get("me");
    if (!row) return null;
    const revision = row.completionRevision ?? 0;
    const context = await readCompletionContext(db);
    let payload = row.payload;
    if (payload.completionItems !== undefined) {
      payload = {
        ...payload,
        stats: { ...payload.stats, volumesRead: composeCompletedCount(payload.completionItems, revision, context) },
      };
    }
    if (payload.collections?.items.some((collection) => collection.completionItems !== undefined)) {
      return {
        ...payload,
        collections: { items: payload.collections.items.map((collection) => ({
          ...collection,
          ...composeCollectionCounts({ ...collection, completionRevision: revision }, context),
        })) },
      };
    }
    if (await db.collectionMembershipMutations.count() === 0) return payload;
    // Old cached home payloads have no complete membership/status snapshot.
    // Retain their prior membership fallback without replacing newer home
    // aggregates that carry their own complete completion metadata.
    if (await readCollectionPickerOptions() === null) return payload;
    const library = await readLibraryView();
    if (!library) return payload;
    return {
      ...payload,
      collections: { items: library.collections.slice(0, 6).map((collection) => ({
        id: collection.id, slug: collection.slug, name: collection.name,
        description: collection.description, kind: collection.kind, smartKey: collection.smartKey,
        itemCount: collection.itemCount, unreadCount: collection.unreadCount,
      })) },
    };
  });
}

export async function clearHome(): Promise<void> {
  const db = getDb();
  await db.home.clear();
}
