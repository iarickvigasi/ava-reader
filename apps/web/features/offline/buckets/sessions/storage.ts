// Dexie I/O for reading sessions. The schema's `sessions` table already
// matches what we need: client-generated `clientSessionId` (PK), start/end
// timestamps, `state` ("open" | "closed"), and `syncedAt` (null until the
// server has acked the session).
//
// The model:
//   - Reader mounts → create row, state="open".
//   - As user reads, lastHeartbeatAt is bumped (local writes only).
//   - Tab hides / unloads / explicit close → state="closed",
//     endedAt = lastHeartbeatAt.
//   - Sync runner finds closed rows with syncedAt=null and posts them; on
//     ack, syncedAt is set so they're not re-sent.
//
// Reading hours = sum of (endedAt - startedAt) across all synced sessions on
// the server. Whether the session was created online or replayed from a
// queue doesn't matter for the totals.

import { getDb, type SessionRow } from "../../db";

export async function createLocalSession(input: {
  clientSessionId: string;
  libraryItemId: string;
  startedAt: string;
}): Promise<void> {
  const db = getDb();
  await db.sessions.put({
    clientSessionId: input.clientSessionId,
    serverSessionId: null,
    libraryItemId: input.libraryItemId,
    startedAt: input.startedAt,
    endedAt: null,
    lastHeartbeatAt: input.startedAt,
    state: "open",
    syncedAt: null,
  });
}

// Bumps lastHeartbeatAt without touching state. Cheap, called every ~30s
// while the reader is in the foreground.
export async function markSessionActive(
  clientSessionId: string,
  at: string,
): Promise<void> {
  const db = getDb();
  const row = await db.sessions.get(clientSessionId);
  if (!row || row.state === "closed") {
    return;
  }
  await db.sessions.put({ ...row, lastHeartbeatAt: at });
}

// Transitions a session to closed, sealing the endedAt timestamp. Called
// from the existing stop-session path AND from any "abandoned session"
// reaper logic (a row left open across page loads is closed retroactively
// with endedAt = lastHeartbeatAt).
export async function closeLocalSession(input: {
  clientSessionId: string;
  endedAt: string;
}): Promise<void> {
  const db = getDb();
  const row = await db.sessions.get(input.clientSessionId);
  if (!row) {
    return;
  }
  await db.sessions.put({
    ...row,
    state: "closed",
    endedAt: input.endedAt,
  });
}

// Marks a session as acknowledged by the server. The serverSessionId is
// captured so any follow-up calls (heartbeat / stop) can target the same
// server-side row.
export async function markSessionSynced(input: {
  clientSessionId: string;
  serverSessionId: string | null;
  syncedAt: string;
}): Promise<void> {
  const db = getDb();
  const row = await db.sessions.get(input.clientSessionId);
  if (!row) {
    return;
  }
  await db.sessions.put({
    ...row,
    serverSessionId: input.serverSessionId ?? row.serverSessionId,
    syncedAt: input.syncedAt,
  });
}

// Returns rows that need a replay: closed, locally complete, server hasn't
// confirmed yet. The sync runner drains this list on every online tick.
export async function listUnsyncedClosedSessions(): Promise<SessionRow[]> {
  const db = getDb();
  return db.sessions
    .filter((row) => row.state === "closed" && row.syncedAt === null)
    .toArray();
}

// Reading-time helpers — sum the closed session durations per book. The
// home screen / stats bucket (phase 4 future work) will read from these
// when the server endpoint isn't reachable yet.
export async function sumReadingSecondsByBook(): Promise<
  Map<string, number>
> {
  const db = getDb();
  const rows = await db.sessions
    .filter((row) => row.state === "closed" && !!row.endedAt)
    .toArray();
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.endedAt) {
      continue;
    }
    const seconds = Math.max(
      0,
      Math.round(
        (new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime()) /
          1000,
      ),
    );
    totals.set(row.libraryItemId, (totals.get(row.libraryItemId) ?? 0) + seconds);
  }
  return totals;
}

export async function sumReadingSecondsTotal(): Promise<number> {
  const totals = await sumReadingSecondsByBook();
  let sum = 0;
  for (const value of totals.values()) {
    sum += value;
  }
  return sum;
}
