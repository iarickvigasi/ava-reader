import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DB_NAME, __resetDbForTests, getDb } from "../db";
import {
  __test,
  readHighlightCountDelta,
  readLocalVolumesRead,
  readUnsyncedSessionDeltas,
} from "./local-deltas";

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

describe("readUnsyncedSessionDeltas", () => {
  it("returns zeros when there are no sessions", async () => {
    const out = await readUnsyncedSessionDeltas();
    expect(out.totalSeconds).toBe(0);
    expect(out.byBookSeconds.size).toBe(0);
    expect(out.byUtcDaySeconds.size).toBe(0);
  });

  it("includes only closed, unsynced sessions", async () => {
    const db = getDb();
    // 600 seconds — closed + unsynced → counted.
    await db.sessions.put({
      clientSessionId: "cs-1",
      serverSessionId: null,
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
      endedAt: "2026-04-12T10:10:00.000Z",
      lastHeartbeatAt: "2026-04-12T10:10:00.000Z",
      state: "closed",
      syncedAt: null,
    });
    // 60 seconds — already synced → excluded.
    await db.sessions.put({
      clientSessionId: "cs-2",
      serverSessionId: "srv-1",
      libraryItemId: "lib-2",
      startedAt: "2026-04-12T11:00:00.000Z",
      endedAt: "2026-04-12T11:01:00.000Z",
      lastHeartbeatAt: "2026-04-12T11:01:00.000Z",
      state: "closed",
      syncedAt: "2026-04-12T11:02:00.000Z",
    });
    // Open session → excluded (no endedAt yet).
    await db.sessions.put({
      clientSessionId: "cs-3",
      serverSessionId: null,
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T12:00:00.000Z",
      endedAt: null,
      lastHeartbeatAt: "2026-04-12T12:01:00.000Z",
      state: "open",
      syncedAt: null,
    });

    const out = await readUnsyncedSessionDeltas();
    expect(out.totalSeconds).toBe(600);
    expect(out.byBookSeconds.get("lib-1")).toBe(600);
    expect(out.byBookSeconds.get("lib-2")).toBeUndefined();
    expect(out.byUtcDaySeconds.get("2026-04-12")).toBe(600);
  });

  it("buckets per-UTC-day correctly for sessions on different days", async () => {
    const db = getDb();
    await db.sessions.bulkPut([
      {
        clientSessionId: "cs-a",
        serverSessionId: null,
        libraryItemId: "lib-1",
        startedAt: "2026-04-11T23:50:00.000Z", // bucket → 2026-04-11
        endedAt: "2026-04-11T23:55:00.000Z",
        lastHeartbeatAt: "2026-04-11T23:55:00.000Z",
        state: "closed",
        syncedAt: null,
      },
      {
        clientSessionId: "cs-b",
        serverSessionId: null,
        libraryItemId: "lib-1",
        startedAt: "2026-04-12T01:00:00.000Z", // bucket → 2026-04-12
        endedAt: "2026-04-12T01:30:00.000Z",
        lastHeartbeatAt: "2026-04-12T01:30:00.000Z",
        state: "closed",
        syncedAt: null,
      },
    ]);
    const out = await readUnsyncedSessionDeltas();
    expect(out.byUtcDaySeconds.get("2026-04-11")).toBe(300);
    expect(out.byUtcDaySeconds.get("2026-04-12")).toBe(1800);
  });

  it("toUtcDayKey formats YYYY-MM-DD in UTC", () => {
    expect(__test.toUtcDayKey("2026-04-12T23:59:59.000Z")).toBe("2026-04-12");
    expect(__test.toUtcDayKey("2026-04-12T00:00:00.000Z")).toBe("2026-04-12");
    expect(__test.toUtcDayKey("2026-04-12T15:30:00-08:00")).toBe(
      "2026-04-12",
    );
  });
});

describe("readHighlightCountDelta", () => {
  it("counts new pending upserts as +1 and pending deletes of known rows as -1", async () => {
    const db = getDb();
    // One existing server snapshot row.
    await db.highlights.put({
      libraryItemId: "lib-1",
      id: "h-existing",
      excerpt: "x",
      color: "apricot",
      locator: null,
      createdAt: "2026-04-12T10:00:00.000Z",
      updatedAt: "2026-04-12T10:00:00.000Z",
    });
    // Pending upsert for a NEW id → +1
    await db.highlightMutations.put({
      mutationId: "h-new",
      scopeId: "lib-1",
      kind: "upsert",
      highlightId: "h-new",
      payload: { excerpt: "y", highlightColor: "rose", locator: null },
      queuedAt: "2026-04-12T11:00:00.000Z",
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    // Pending upsert for an EXISTING id → 0 (no count change, just edit)
    await db.highlightMutations.put({
      mutationId: "h-existing",
      scopeId: "lib-1",
      kind: "upsert",
      highlightId: "h-existing",
      payload: { excerpt: "edited", highlightColor: "jade", locator: null },
      queuedAt: "2026-04-12T11:00:00.000Z",
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    // Pending delete for an unknown id → 0 (server never had it)
    await db.highlightMutations.put({
      mutationId: "h-ghost",
      scopeId: "lib-1",
      kind: "delete",
      highlightId: "h-ghost",
      payload: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    // Pending delete for a known id → -1
    // Use a separate row that isn't being edited above to avoid collision
    await db.highlights.put({
      libraryItemId: "lib-1",
      id: "h-to-delete",
      excerpt: "z",
      color: "apricot",
      locator: null,
      createdAt: "2026-04-12T10:00:00.000Z",
      updatedAt: "2026-04-12T10:00:00.000Z",
    });
    await db.highlightMutations.put({
      mutationId: "h-to-delete",
      scopeId: "lib-1",
      kind: "delete",
      highlightId: "h-to-delete",
      payload: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });

    const delta = await readHighlightCountDelta();
    expect(delta).toBe(0); // +1 (new) + 0 (edit) + 0 (ghost) - 1 (delete known)
  });

  it("returns 0 when there are no pending mutations", async () => {
    expect(await readHighlightCountDelta()).toBe(0);
  });
});

describe("readLocalVolumesRead", () => {
  it("returns null when no progress rows exist", async () => {
    expect(await readLocalVolumesRead()).toBeNull();
  });

  it("counts only rows where completionPercent >= 100", async () => {
    const db = getDb();
    await db.progress.bulkPut([
      {
        libraryItemId: "lib-1",
        locator: null,
        completionPercent: 100,
        lastLocalUpdateAt: "2026-04-12T10:00:00.000Z",
        lastServerUpdateAt: null,
        dirty: false,
      },
      {
        libraryItemId: "lib-2",
        locator: null,
        completionPercent: 100,
        lastLocalUpdateAt: "2026-04-12T10:00:00.000Z",
        lastServerUpdateAt: "2026-04-12T10:00:00.000Z",
        dirty: false,
      },
      {
        libraryItemId: "lib-3",
        locator: null,
        completionPercent: 73,
        lastLocalUpdateAt: "2026-04-12T10:00:00.000Z",
        lastServerUpdateAt: null,
        dirty: false,
      },
    ]);
    expect(await readLocalVolumesRead()).toBe(2);
  });
});
