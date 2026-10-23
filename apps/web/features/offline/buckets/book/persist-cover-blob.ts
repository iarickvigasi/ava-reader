import { getDb } from "../../db";
import { refreshCover } from "./covers/refresh";

const pending = new WeakMap<object, Map<string, Promise<void>>>();

// Only missing, invalid, or migrated-unverified covers need network bytes.
export async function persistCoverFromNetwork(
  id: string,
  src: string,
): Promise<void> {
  const db = getDb();
  let requests = pending.get(db);
  if (!requests) pending.set(db, (requests = new Map()));
  const existing = requests.get(id);
  if (existing) return existing;
  const task = refreshCover(db, id, src);
  requests.set(id, task);
  try {
    await task;
  } finally {
    requests.delete(id);
  }
}
