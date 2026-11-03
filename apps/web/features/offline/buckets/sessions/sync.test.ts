import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb } from "../../db";
import { checkpointRow } from "./checkpoint-row-fixture";
import { needsSessionSync } from "./needs-session-sync";
import { syncPendingSessions } from "./sync";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const getToken = async () => "token";
const pendingRows = () => getDb().sessions.filter(needsSessionSync).toArray();

it("uploads a closed checkpoint and acknowledges the saved revision", async () => {
  await getDb().sessions.put(checkpointRow());
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ sessionId: "server", revision: 2, durationSeconds: 60 }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await syncPendingSessions(getToken)).toEqual({ synced: 1 });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain("/reader/session/checkpoint");
  expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({
    clientSessionId: "session",
    startedAt: "2026-11-03T10:00:00.000Z",
    checkpointAt: "2026-11-03T10:01:00.000Z",
    endedAt: "2026-11-03T10:01:00.000Z",
    timeZone: "UTC",
    revision: 2,
  });
  expect((await getDb().sessions.get("session"))?.acknowledgedRevision).toBe(2);
  expect(await pendingRows()).toHaveLength(0);
});

it("leaves a failed checkpoint pending for the next attempt", async () => {
  await getDb().sessions.put(checkpointRow());
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
  );
  expect(await syncPendingSessions(getToken)).toEqual({ synced: 0 });
  expect(await pendingRows()).toHaveLength(1);
});

it("stops retrying a permanently rejected checkpoint", async () => {
  await getDb().sessions.put(checkpointRow());
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 422 }));
  vi.stubGlobal("fetch", fetch);
  await syncPendingSessions(getToken);
  await syncPendingSessions(getToken);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await pendingRows()).toHaveLength(0);
});

it("uploads multiple independent sessions in one pass", async () => {
  await getDb().sessions.bulkPut(
    ["a", "b", "c"].map((clientSessionId) =>
      checkpointRow({ clientSessionId }),
    ),
  );
  const fetch = vi
    .fn()
    .mockImplementation(async () =>
      Response.json({ sessionId: "server", revision: 2, durationSeconds: 60 }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await syncPendingSessions(getToken)).toEqual({ synced: 3 });
  expect(fetch).toHaveBeenCalledTimes(3);
});
