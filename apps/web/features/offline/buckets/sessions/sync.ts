import { listUnsyncedClosedSessions, markSessionSynced } from "./storage";
import { postSession } from "./post-session";

type GetToken = () => Promise<string | null>;

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
        replayStatus: "dropped",
      });
      continue;
    }
    await markSessionSynced({
      clientSessionId: row.clientSessionId,
      serverSessionId: null,
      syncedAt: new Date().toISOString(),
      replayStatus: "acknowledged",
    });
    synced += 1;
  }
  return { synced };
}
