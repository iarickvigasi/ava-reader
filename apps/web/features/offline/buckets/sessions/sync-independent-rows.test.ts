import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb } from "../../db";
import { checkpointRow } from "./checkpoint-row-fixture";
import { syncPendingSessions } from "./sync";
import { SESSION_LEASE_KEY, SESSION_MAX_GAP_MS } from "./constants";
import { listPendingSessions } from "./list-pending-sessions";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it.each([404, 503])(
  "uploads another book after a retryable %s",
  async (status) => {
    await getDb().sessions.bulkPut([
      checkpointRow({ clientSessionId: "a", state: "open", endedAt: null }),
      checkpointRow({ clientSessionId: "b", libraryItemId: "other-book" }),
    ]);
    await getDb().meta.put({
      key: SESSION_LEASE_KEY,
      updatedAt: new Date().toISOString(),
      value: {
        ownerId: "active-tab",
        clientSessionId: "a",
        expiresAt: Date.now() + SESSION_MAX_GAP_MS,
      },
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(
        Response.json({
          sessionId: "remote",
          revision: 2,
          durationSeconds: 60,
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await syncPendingSessions(async () => "token")).toEqual({
      synced: 1,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      (await listPendingSessions()).map((row) => row.clientSessionId),
    ).toEqual(["a"]);
  },
);
