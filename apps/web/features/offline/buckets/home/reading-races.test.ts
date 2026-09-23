import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { syncPendingSessions } from "../sessions";
import { applyHome, readHome } from "./storage";
import { readingHome, seedReading } from "./reading-test-fixture";

beforeEach(seedReading);
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function expectOneSession() {
  const home = await readHome();
  expect(home?.stats.hoursReading).toBe(1);
  expect(home?.mastery.days.slice(-2).map((day) => day.minutes)).toEqual([
    30, 30,
  ]);
  expect(home?.mastery.todayMinutes).toBe(30);
}

it("counts once when GET includes the replay before its POST response arrives", async () => {
  let respond!: (response: Response) => void;
  let posted!: () => void;
  const started = new Promise<void>((resolve) => {
    posted = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      posted();
      return new Promise<Response>((resolve) => {
        respond = resolve;
      });
    }),
  );
  const sync = syncPendingSessions(async () => "token", "device");
  await started;
  await applyHome(readingHome(true));
  expect((await getDb().sessions.get("offline-session"))?.syncedAt).toBeNull();
  await expectOneSession();
  respond(new Response(null, { status: 200 }));
  await sync;
  await expectOneSession();
});

it("retains acknowledged time through stale snapshots and a local DB reopen", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  );
  await syncPendingSessions(async () => "token", "device");
  expect((await getDb().sessions.get("offline-session"))?.replayStatus).toBe(
    "acknowledged",
  );
  await expectOneSession();
  getDb().close();
  await getDb().open();
  await expectOneSession();
  await applyHome(readingHome(true));
  await expectOneSession();
  await applyHome(readingHome());
  await expectOneSession();
});

it("deduplicates a server commit whose POST response was lost", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  await syncPendingSessions(async () => "token", "device");
  await applyHome(readingHome(true));
  await expectOneSession();
  expect((await getDb().sessions.get("offline-session"))?.syncedAt).toBeNull();
});

it("removes permanently rejected time and does not retry it", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  await syncPendingSessions(async () => "token", "device");
  expect((await getDb().sessions.get("offline-session"))?.replayStatus).toBe(
    "dropped",
  );
  expect((await readHome())?.stats.hoursReading).toBe(0);
  await syncPendingSessions(async () => "token", "device");
  expect(fetch).toHaveBeenCalledTimes(1);
});
