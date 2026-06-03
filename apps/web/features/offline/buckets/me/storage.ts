// Dexie I/O for the current-user cache. Single row keyed by "me". Cached so
// the app layout can render its nav (display name, avatar, admin entry) when
// the app is opened or reloaded offline — the service worker serves the HTML
// shell, this row feeds the data.

import type { CurrentUserPayload } from "@/lib/api-types/user";

import { getDb } from "../../db";

export async function applyCurrentUser(
  user: CurrentUserPayload,
): Promise<void> {
  const db = getDb();
  await db.me.put({ id: "me", user, fetchedAt: new Date().toISOString() });
}

export async function readCurrentUser(): Promise<CurrentUserPayload | null> {
  const db = getDb();
  const row = await db.me.get("me");
  return row?.user ?? null;
}

// Clears the cached user. Called on sign-out so the next account doesn't
// briefly see the previous user's nav while offline.
export async function clearCurrentUser(): Promise<void> {
  const db = getDb();
  await db.me.clear();
}
