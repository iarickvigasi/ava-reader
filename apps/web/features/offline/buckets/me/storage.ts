// Dexie I/O for the current-user cache. Single row keyed by "me". Cached so
// the app layout can render its nav (display name, avatar, admin entry) when
// the app is opened or reloaded offline — the service worker serves the HTML
// shell, this row feeds the data.

import type { CurrentUserPayload } from "@/lib/api-types/user";

import { getDb } from "../../db";

// Preserves the cached avatarBlob across re-applies — every online reload
// re-fetches and re-applies the user, and a `put` replaces the whole row, so
// skipping this would silently evict the cached photo on every visit.
export async function applyCurrentUser(
  user: CurrentUserPayload,
): Promise<void> {
  const db = getDb();
  const existing = await db.me.get("me");
  await db.me.put({
    id: "me",
    user,
    avatarBlob: existing?.avatarBlob ?? null,
    fetchedAt: new Date().toISOString(),
  });
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

// Cache-first, lazy-write-through avatar photo — mirrors
// buckets/book/storage.ts's coverBlob (see [[4.9-header-avatar]]). Single row,
// so no id parameter: there's only ever one signed-in user per database.
export async function attachAvatarBlob(blob: Blob | null): Promise<void> {
  const db = getDb();
  const row = await db.me.get("me");
  if (!row) {
    return;
  }
  await db.me.put({ ...row, avatarBlob: blob });
}

export async function readAvatarBlob(): Promise<Blob | null> {
  const db = getDb();
  const row = await db.me.get("me");
  return row?.avatarBlob ?? null;
}
