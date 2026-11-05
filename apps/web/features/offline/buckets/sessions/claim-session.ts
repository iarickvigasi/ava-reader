import { getDb, type AvaReaderDB } from "../../db";
import { deviceTimeZone } from "../../stats/device-time-zone";
import { SESSION_TRACKING_VERSION } from "./constants";
import { generateClientSessionId } from "./id";
import { sealAbandonedSessions } from "./seal-abandoned-sessions";
import { readSessionLease, writeSessionLease } from "./session-lease";
import type { ClaimSessionInput, SessionRow } from "./types";

// The lease and session share one transaction, including across browser tabs.
export async function claimSession(
  db: AvaReaderDB,
  input: ClaimSessionInput,
): Promise<string | null> {
  if (db !== getDb()) return null;
  return db.transaction("rw", [db.meta, db.sessions], async () => {
    if (db !== getDb()) return null;
    const lease = await readSessionLease(db);
    if (!input.exclusive && lease && lease.expiresAt > input.now) return null;
    await sealAbandonedSessions(db);
    const row = createSessionRow(input.libraryItemId, input.now);
    await db.sessions.put(row);
    await writeSessionLease(
      db,
      {
        ownerId: input.ownerId,
        clientSessionId: row.clientSessionId,
      },
      input.now,
    );
    return row.clientSessionId;
  });
}

function createSessionRow(libraryItemId: string, now: number): SessionRow {
  const at = new Date(now).toISOString();
  return {
    clientSessionId: generateClientSessionId(),
    libraryItemId,
    startedAt: at,
    lastHeartbeatAt: at,
    timeZone: deviceTimeZone(),
    endedAt: null,
    state: "open",
    trackingVersion: SESSION_TRACKING_VERSION,
    revision: 1,
    acknowledgedRevision: 0,
  };
}
