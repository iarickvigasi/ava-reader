import { withDeadline } from "@/features/auth/with-deadline";
import { getDb, type AvaReaderDB } from "../../db";
import { listPendingSessions } from "./list-pending-sessions";
import { recoverSessions } from "./recover-sessions";
import { syncSession } from "./sync-session";

type GetToken = () => Promise<string | null>;
type Result = { synced: number };
const running = new WeakMap<AvaReaderDB, Promise<Result>>();

export function syncPendingSessions(getToken: GetToken): Promise<Result> {
  const db = getDb();
  const prior = running.get(db);
  if (prior) return prior;
  const work = uploadPendingCheckpoints(db, getToken)
    .catch(() => ({ synced: 0 }))
    .finally(() => running.delete(db));
  running.set(db, work);
  return work;
}

async function uploadPendingCheckpoints(
  db: AvaReaderDB,
  getToken: GetToken,
): Promise<Result> {
  await recoverSessions(db);
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return { synced: 0 };
  const pending = await listPendingSessions(db);
  let synced = 0;
  for (const row of pending) {
    const token = await withDeadline(getToken());
    if (!token || db !== getDb()) break;
    const result = await syncSession(db, token, row);
    if (db !== getDb()) break;
    if (result === "ok") synced++;
  }
  return { synced };
}
