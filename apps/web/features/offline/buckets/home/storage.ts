// Dexie I/O for the home-screen cache. Single row keyed by "me". Cached so
// the dashboard renders when the app is opened or reloaded offline.

import type { HomePayload } from "@/lib/api-types/home";

import { getDb } from "../../db";
import { readCollectionPickerOptions, readLibraryView } from "../library";

export async function applyHome(payload: HomePayload): Promise<void> {
  const db = getDb();
  await db.home.put({ id: "me", payload, fetchedAt: new Date().toISOString() });
}

export async function readHome(): Promise<HomePayload | null> {
  const db = getDb();
  const row = await db.home.get("me");
  if (!row) return null;
  if (await db.collectionMembershipMutations.count() === 0) return row.payload;
  // Pending edits share the library's membership/count view. Otherwise the
  // home response is authoritative and may be newer than the library cache.
  // A single cached collection cannot establish the complete home panel.
  if (await readCollectionPickerOptions() === null) return row.payload;
  const library = await readLibraryView();
  if (!library) return row.payload;
  return {
    ...row.payload,
    collections: { items: library.collections.slice(0, 6).map((collection) => ({
      id: collection.id, slug: collection.slug, name: collection.name,
      description: collection.description, kind: collection.kind, smartKey: collection.smartKey,
      itemCount: collection.itemCount, unreadCount: collection.unreadCount,
    })) },
  };
}

export async function clearHome(): Promise<void> {
  const db = getDb();
  await db.home.clear();
}
