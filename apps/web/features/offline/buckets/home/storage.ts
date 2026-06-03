// Dexie I/O for the home-screen cache. Single row keyed by "me". Cached so
// the dashboard renders when the app is opened or reloaded offline.

import type { HomePayload } from "@/lib/api-types/home";

import { getDb } from "../../db";

export async function applyHome(payload: HomePayload): Promise<void> {
  const db = getDb();
  await db.home.put({ id: "me", payload, fetchedAt: new Date().toISOString() });
}

export async function readHome(): Promise<HomePayload | null> {
  const db = getDb();
  const row = await db.home.get("me");
  return row?.payload ?? null;
}

export async function clearHome(): Promise<void> {
  const db = getDb();
  await db.home.clear();
}
