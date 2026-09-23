import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { __resetDbForTests, getDb } from "../db";
import { readUnsyncedSessionDeltas } from "./local-deltas";
import { composeMastery } from "./compose-mastery";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("credits both dates and preserves mastery when a fresh server baseline replaces the delta", async () => {
  const db = getDb();
  await db.sessions.put({
    clientSessionId: "midnight",
    serverSessionId: null,
    libraryItemId: "book",
    startedAt: "2026-04-12T23:40:00Z",
    endedAt: "2026-04-13T00:30:00Z",
    lastHeartbeatAt: "2026-04-13T00:30:00Z",
    state: "closed",
    syncedAt: null,
  });
  const delta = await readUnsyncedSessionDeltas();
  expect(delta.totalSeconds).toBe(3000);
  expect(delta.byBookSeconds.get("book")).toBe(3000);
  expect([...delta.byUtcDaySeconds]).toEqual([
    ["2026-04-12", 1200],
    ["2026-04-13", 1800],
  ]);
  const baseline = {
    dailyGoalMinutes: 30,
    days: [],
    todayMinutes: 0,
    remainingMinutes: 30,
  };
  const offline = composeMastery(
    baseline,
    delta.byUtcDaySeconds,
    30,
    "2026-04-13",
  );
  expect(offline.days.slice(-2)).toEqual([
    { key: "2026-04-12", minutes: 20, goalMet: false },
    { key: "2026-04-13", minutes: 30, goalMet: true },
  ]);
  expect(offline.todayMinutes).toBe(30);
  expect(offline.remainingMinutes).toBe(0);
  await db.sessions.update("midnight", { syncedAt: "2026-04-13T01:00:00Z" });
  const synced = await readUnsyncedSessionDeltas();
  expect(synced.totalSeconds).toBe(0);
  expect(
    composeMastery(offline, synced.byUtcDaySeconds, 30, "2026-04-13"),
  ).toEqual(offline);
});

it("accumulates sessions while keeping capped book, day and overall seconds consistent", async () => {
  for (const [id, end] of [
    ["long", "2026-04-15T00:30:00Z"],
    ["short", "2026-04-13T00:30:00Z"],
  ]) {
    await getDb().sessions.put({
      clientSessionId: id,
      serverSessionId: null,
      libraryItemId: "book",
      startedAt: "2026-04-12T23:40:00Z",
      endedAt: end,
      lastHeartbeatAt: end,
      state: "closed",
      syncedAt: null,
    });
  }
  const delta = await readUnsyncedSessionDeltas();
  expect(delta.totalSeconds).toBe(89400);
  expect(delta.byBookSeconds.get("book")).toBe(89400);
  expect([...delta.byUtcDaySeconds]).toEqual([
    ["2026-04-12", 2400],
    ["2026-04-13", 87000],
  ]);
});
