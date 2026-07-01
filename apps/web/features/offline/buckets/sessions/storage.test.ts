import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DB_NAME, __resetDbForTests, getDb } from "../../db";
import {
  closeLocalSession,
  createLocalSession,
  listUnsyncedClosedSessions,
  markSessionActive,
  markSessionSynced,
} from "./storage";

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("sessions storage", () => {
  it("createLocalSession seeds an open row with state=open and syncedAt=null", async () => {
    await createLocalSession({
      clientSessionId: "cs-1",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
    });
    const row = await getDb().sessions.get("cs-1");
    expect(row?.state).toBe("open");
    expect(row?.syncedAt).toBeNull();
    expect(row?.endedAt).toBeNull();
    expect(row?.lastHeartbeatAt).toBe("2026-04-12T10:00:00.000Z");
  });

  it("markSessionActive bumps lastHeartbeatAt only", async () => {
    await createLocalSession({
      clientSessionId: "cs-1",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
    });
    await markSessionActive("cs-1", "2026-04-12T10:05:00.000Z");
    const row = await getDb().sessions.get("cs-1");
    expect(row?.lastHeartbeatAt).toBe("2026-04-12T10:05:00.000Z");
    expect(row?.state).toBe("open");
  });

  it("markSessionActive ignores closed sessions", async () => {
    await createLocalSession({
      clientSessionId: "cs-1",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
    });
    await closeLocalSession({
      clientSessionId: "cs-1",
      endedAt: "2026-04-12T10:03:00.000Z",
    });
    await markSessionActive("cs-1", "2026-04-12T10:10:00.000Z");
    const row = await getDb().sessions.get("cs-1");
    // Closed sessions keep their endedAt as the lastHeartbeatAt — no
    // late "still active" claim can over-count the duration.
    expect(row?.lastHeartbeatAt).toBe("2026-04-12T10:00:00.000Z");
  });

  it("listUnsyncedClosedSessions returns only closed rows that haven't been acked", async () => {
    await createLocalSession({
      clientSessionId: "open-1",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
    });
    await createLocalSession({
      clientSessionId: "closed-synced",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T09:00:00.000Z",
    });
    await closeLocalSession({
      clientSessionId: "closed-synced",
      endedAt: "2026-04-12T09:10:00.000Z",
    });
    await markSessionSynced({
      clientSessionId: "closed-synced",
      serverSessionId: "srv-1",
      syncedAt: "2026-04-12T09:11:00.000Z",
    });
    await createLocalSession({
      clientSessionId: "closed-unsynced",
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T08:00:00.000Z",
    });
    await closeLocalSession({
      clientSessionId: "closed-unsynced",
      endedAt: "2026-04-12T08:10:00.000Z",
    });

    const pending = await listUnsyncedClosedSessions();
    expect(pending.map((row) => row.clientSessionId)).toEqual([
      "closed-unsynced",
    ]);
  });
});
