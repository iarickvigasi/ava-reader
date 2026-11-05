import type { AvaReaderDB } from "../../db";
import { SESSION_LEASE_KEY, SESSION_MAX_GAP_MS } from "./constants";
import type { SessionLease } from "./types";

export async function readSessionLease(db: AvaReaderDB) {
  const row = await db.meta.get(SESSION_LEASE_KEY);
  return row?.value as SessionLease | undefined;
}

// Call inside the same transaction that saves the owned session checkpoint.
export function writeSessionLease(
  db: AvaReaderDB,
  owner: Pick<SessionLease, "ownerId" | "clientSessionId">,
  now: number,
) {
  return db.meta.put({
    key: SESSION_LEASE_KEY,
    updatedAt: new Date(now).toISOString(),
    value: { ...owner, expiresAt: now + SESSION_MAX_GAP_MS },
  });
}
