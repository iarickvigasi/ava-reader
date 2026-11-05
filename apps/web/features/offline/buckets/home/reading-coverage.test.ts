import "fake-indexeddb/auto";
import { liveQuery } from "dexie";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { applyHome, readHome } from "./storage";
import {
  readingHome,
  readingSession,
  seedReading,
} from "./reading-test-fixture";

vi.mock("../../stats/device-time-zone", () => ({
  deviceTimeZone: () => "UTC",
}));

beforeEach(seedReading);
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.useRealTimers();
});

it("reconciles old sessions against all-time IDs, outside the mastery window", async () => {
  await getDb().sessions.update(readingSession.clientSessionId, {
    startedAt: "2025-01-01T10:00:00Z",
    endedAt: "2025-01-01T11:00:00Z",
  });
  expect((await readHome())?.stats.hoursReading).toBe(1);
  expect(
    (await readHome())?.mastery.days.every((day) => day.minutes === 0),
  ).toBe(true);
  const home = readingHome(true);
  home.readingSnapshot!.days = [];
  await applyHome(home);
  expect((await readHome())?.stats.hoursReading).toBe(1);
  expect((await readHome())?.mastery.todayMinutes).toBe(0);
});

it("rounds combined seconds once and does not mutate the persisted baseline", async () => {
  const home = readingHome();
  home.readingSnapshot!.totalSeconds = 3599;
  home.readingSnapshot!.days = [{ key: "2026-04-13", seconds: 59 }];
  await getDb().sessions.update(readingSession.clientSessionId, {
    startedAt: "2026-04-13T10:00:00Z",
    endedAt: "2026-04-13T10:00:01Z",
  });
  await applyHome(home);
  expect((await readHome())?.stats.hoursReading).toBe(1);
  expect((await readHome())?.mastery.todayMinutes).toBe(1);
  expect((await getDb().home.get("me"))?.payload).toEqual(home);
});

it("keeps saved server totals when this device has no local recordings", async () => {
  const home = readingHome(true);
  delete home.readingSnapshot;
  await getDb().sessions.clear();
  await getDb().home.clear();
  await applyHome(home);
  expect((await readHome())?.stats.hoursReading).toBe(1);
  await applyHome(readingHome(true));
  expect((await readHome())?.stats.hoursReading).toBe(1);
});

it("retains acknowledged checkpoints until the snapshot covers them", async () => {
  await getDb().sessions.update(readingSession.clientSessionId, {
    acknowledgedRevision: readingSession.revision,
  });
  expect((await readHome())?.stats.hoursReading).toBe(1);
});

it("reacts to session writes without a timer or online event", async () => {
  let next!: (hours: number | undefined) => void;
  const observed = () =>
    new Promise<number | undefined>((resolve) => {
      next = resolve;
    });
  const initial = observed();
  const subscription = liveQuery(readHome).subscribe((home) =>
    next(home?.stats.hoursReading),
  );
  try {
    expect(await initial).toBe(1);
    const changed = observed();
    await getDb().sessions.update(readingSession.clientSessionId, {
      dropped: true,
    });
    expect(await changed).toBe(0);
  } finally {
    subscription.unsubscribe();
  }
});
