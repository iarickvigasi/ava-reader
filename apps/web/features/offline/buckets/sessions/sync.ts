// Replays closed-but-unsynced reading sessions to the server. The API
// accepts a `clientSessionId` + optional startedAt/endedAt on POST
// /reader/session, so we post each row in turn and mark it synced on ack.
// One session at a time per call so partial failures don't compound.

import { getPublicApiBaseUrl } from "@/lib/api";

import { listUnsyncedClosedSessions, markSessionSynced } from "./storage";

type GetToken = () => Promise<string | null>;

type ReplayOk = { kind: "ok" };
type ReplayRetry = { kind: "retry" };
type ReplayDrop = { kind: "drop"; reason: string };
type ReplayResult = ReplayOk | ReplayRetry | ReplayDrop;

// One pass over the pending queue. Stops on the first retry-worthy failure
// so the next online tick can resume cleanly. Returns the number of rows
// successfully synced for telemetry/tests.
export async function syncPendingSessions(
  getToken: GetToken,
  clientInstanceId: string,
): Promise<{ synced: number }> {
  const pending = await listUnsyncedClosedSessions();
  let synced = 0;
  for (const row of pending) {
    const token = await getToken();
    if (!token) {
      break;
    }
    const result = await postSession(token, clientInstanceId, row);
    if (result.kind === "retry") {
      break;
    }
    if (result.kind === "drop") {
      // Permanent failure (e.g. library item deleted). We *mark synced*
      // anyway so we stop retrying — the offline row stays as local
      // bookkeeping but isn't tried against the server again.
      await markSessionSynced({
        clientSessionId: row.clientSessionId,
        serverSessionId: null,
        syncedAt: new Date().toISOString(),
      });
      continue;
    }
    await markSessionSynced({
      clientSessionId: row.clientSessionId,
      serverSessionId: result.kind === "ok" ? null : null,
      syncedAt: new Date().toISOString(),
    });
    synced += 1;
  }
  return { synced };
}

async function postSession(
  token: string,
  clientInstanceId: string,
  row: {
    libraryItemId: string;
    clientSessionId: string;
    startedAt: string;
    endedAt: string | null;
  },
): Promise<ReplayResult> {
  const url = `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(
    row.libraryItemId,
  )}/reader/session`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        clientInstanceId,
        clientSessionId: row.clientSessionId,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
      }),
    });
    if (response.ok) {
      return { kind: "ok" };
    }
    // Same classification as the highlights flush — transient is 401/408/
    // 425/429/5xx; permanent is 4xx (drop without erroring the user).
    if (
      response.status === 401 ||
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      (response.status >= 500 && response.status < 600)
    ) {
      return { kind: "retry" };
    }
    return { kind: "drop", reason: `HTTP ${response.status}` };
  } catch {
    return { kind: "retry" };
  }
}
