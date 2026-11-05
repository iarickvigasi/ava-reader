import { getDb, type AvaReaderDB } from "../../db";
import { SESSION_LEASE_KEY, SESSION_OWNERSHIP_PREFIX } from "./constants";
import { sealAbandonedSessions } from "./seal-abandoned-sessions";
import { readSessionLease } from "./session-lease";

export async function recoverSessions(db: AvaReaderDB, now = Date.now()) {
  if (db !== getDb()) return;
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(
      `${SESSION_OWNERSHIP_PREFIX}${db.name}`,
      { ifAvailable: true },
      async (lock) => {
        if (lock) await recoverExpiredSessions(db, now);
      },
    );
    return;
  }
  await recoverExpiredSessions(db, now);
}

async function recoverExpiredSessions(db: AvaReaderDB, now: number) {
  await db.transaction("rw", [db.sessions, db.meta], async () => {
    if (db !== getDb()) return;
    const lease = await readSessionLease(db);
    if (lease && lease.expiresAt > now) return;
    await sealAbandonedSessions(db);
    await db.meta.delete(SESSION_LEASE_KEY);
  });
}
