import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { applyHome, readHome } from "./storage";
import {
  checkpointHome,
  checkpointSession,
} from "../../stats/checkpoint-fixture";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.useRealTimers();
});

it("retains pending time across snapshot/ack races, reload, and stale remote responses", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(
    new Date("2026-11-03T12:00:00Z"),
  );
  await getDb().sessions.put(checkpointSession(8));
  await applyHome(checkpointHome(300, 2));
  expect((await readHome())?.mastery.todayMinutes).toBe(18);
  await applyHome(checkpointHome(480, 3));
  expect((await readHome())?.mastery.todayMinutes).toBe(18);
  await getDb().sessions.update("phone", { acknowledgedRevision: 8 });
  getDb().close();
  await getDb().open();
  await applyHome(checkpointHome(0, 1));
  expect((await readHome())?.mastery.todayMinutes).toBe(18);
  expect(
    (await getDb().home.get("me"))?.payload.readingSnapshot?.readingRevision,
  ).toBe(3);
});

it("does not discard a newer remote-only contribution when an older GET arrives", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(
    new Date("2026-11-03T12:00:00Z"),
  );
  await applyHome(checkpointHome(480, 3));
  await applyHome(checkpointHome(0, 1));
  expect((await readHome())?.mastery.todayMinutes).toBe(18);
});
