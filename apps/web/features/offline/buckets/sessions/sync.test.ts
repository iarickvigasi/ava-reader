import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME, __resetDbForTests, getDb } from "../../db";
import {
  closeLocalSession,
  createLocalSession,
  listUnsyncedClosedSessions,
} from "./storage";
import { syncPendingSessions } from "./sync";

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

const getToken = async () => "token";
const CLIENT_INSTANCE = "client-a";

async function seedCompletedSession(input: {
  clientSessionId: string;
  libraryItemId: string;
  startedAt: string;
  endedAt: string;
}) {
  await createLocalSession({
    clientSessionId: input.clientSessionId,
    libraryItemId: input.libraryItemId,
    startedAt: input.startedAt,
  });
  await closeLocalSession({
    clientSessionId: input.clientSessionId,
    endedAt: input.endedAt,
  });
}

describe("syncPendingSessions", () => {
  it("posts each closed-unsynced session and marks it synced on 2xx", async () => {
    await seedCompletedSession({
      clientSessionId: "cs-1",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
      endedAt: "2026-04-12T10:10:00.000Z",
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { synced } = await syncPendingSessions(getToken, CLIENT_INSTANCE);
    expect(synced).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.clientSessionId).toBe("cs-1");
    expect(body.startedAt).toBe("2026-04-12T10:00:00.000Z");
    expect(body.endedAt).toBe("2026-04-12T10:10:00.000Z");

    const row = await getDb().sessions.get("cs-1");
    expect(row?.syncedAt).not.toBeNull();
    expect(await listUnsyncedClosedSessions()).toHaveLength(0);
  });

  it("stops on a 5xx and leaves the row pending for the next tick", async () => {
    await seedCompletedSession({
      clientSessionId: "cs-1",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
      endedAt: "2026-04-12T10:10:00.000Z",
    });
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { synced } = await syncPendingSessions(getToken, CLIENT_INSTANCE);
    expect(synced).toBe(0);
    expect(await listUnsyncedClosedSessions()).toHaveLength(1);
  });

  it("drops on a 4xx but stops re-trying (marks synced to break the loop)", async () => {
    await seedCompletedSession({
      clientSessionId: "cs-1",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
      endedAt: "2026-04-12T10:10:00.000Z",
    });
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await syncPendingSessions(getToken, CLIENT_INSTANCE);
    expect(await listUnsyncedClosedSessions()).toHaveLength(0);
  });

  it("drains a queue of multiple sessions in one pass", async () => {
    for (let i = 0; i < 3; i++) {
      await seedCompletedSession({
        clientSessionId: `cs-${i}`,
        libraryItemId: "lib-1",
        startedAt: `2026-04-12T1${i}:00:00.000Z`,
        endedAt: `2026-04-12T1${i}:10:00.000Z`,
      });
    }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { synced } = await syncPendingSessions(getToken, CLIENT_INSTANCE);
    expect(synced).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
