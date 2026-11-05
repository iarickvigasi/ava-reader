import { getDb, type AvaReaderDB } from "../../db";
import { revalidateHome } from "../home/revalidate";
import { revalidateLibrary } from "../library/revalidate";
import { listDirtyProgress } from "./storage";
import { syncProgressRow } from "./sync-progress-row";
import type { GetProgressToken } from "./types";

type Result = { synced: number };
let running = new WeakMap<AvaReaderDB, Promise<Result>>();

export function flushDirtyProgress(
  getToken: GetProgressToken,
): Promise<Result> {
  const db = getDb();
  const prior = running.get(db);
  if (prior) return prior;
  const work = flushAccountProgress(db, getToken).finally(() =>
    running.delete(db),
  );
  running.set(db, work);
  return work;
}

async function flushAccountProgress(
  db: AvaReaderDB,
  getToken: GetProgressToken,
): Promise<Result> {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return { synced: 0 };
  let synced = 0;
  for (const row of await listDirtyProgress(db)) {
    if (db !== getDb()) break;
    try {
      if (await syncProgressRow(db, row, getToken)) synced++;
    } catch {
      /* The durable row remains pending for the runner's retry. */
    }
  }
  if (synced && db === getDb())
    void Promise.allSettled([
      revalidateHome(getToken),
      revalidateLibrary(getToken),
    ]);
  return { synced };
}

export function __resetProgressSyncForTests() {
  running = new WeakMap();
}
