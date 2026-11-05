import { getDb, type AvaReaderDB } from "../../db";
import { advanceSession } from "./advance-session";
import { SESSION_LEASE_KEY } from "./constants";
import { readSessionLease, writeSessionLease } from "./session-lease";
import type { CheckpointSessionInput } from "./types";

export async function checkpointSession(
  db: AvaReaderDB,
  { ownerId, clientSessionId, tick, stop }: CheckpointSessionInput,
): Promise<boolean> {
  if (db !== getDb()) return false;
  return db.transaction("rw", [db.meta, db.sessions], async () => {
    if (db !== getDb()) return false;
    const lease = await readSessionLease(db);
    const row = await db.sessions.get(clientSessionId);
    if (
      lease?.ownerId !== ownerId ||
      lease.clientSessionId !== clientSessionId ||
      row?.state !== "open"
    )
      return false;
    const checkpoint = advanceSession(row, tick, stop);
    await db.sessions.put(checkpoint);
    const stillOpen = checkpoint.state === "open";
    if (stillOpen) await writeSessionLease(db, lease, tick.wallNow);
    else await db.meta.delete(SESSION_LEASE_KEY);
    return stillOpen;
  });
}
