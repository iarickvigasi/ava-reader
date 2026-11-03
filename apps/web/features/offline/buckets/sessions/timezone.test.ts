import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { createReadingTracker } from "./tracker";
import { postCheckpoint } from "./post-checkpoint";
import { getDb, __resetDbForTests } from "../../db";

const device = vi.hoisted(() => ({ zone: "Europe/Belgrade" }));
vi.mock("../../stats/device-time-zone", () => ({
  deviceTimeZone: () => device.zone,
}));
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
});
it("preserves the start zone through travel, checkpoints, close and upload", async () => {
  let now = Date.parse("2026-11-03T10:00:00Z");
  const clock = { wallNow: () => now, monotonicNow: () => now };
  const tracker = createReadingTracker("book", clock);
  await tracker.start();
  const db = getDb();
  const [initial] = await db.sessions.toArray();
  expect(initial.timeZone).toBe("Europe/Belgrade");
  device.zone = "America/Los_Angeles";
  now += 30_000;
  await tracker.checkpoint();
  now += 5_000;
  await tracker.stop();
  const saved = (await db.sessions.get(initial.clientSessionId))!;
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      sessionId: "server",
      revision: saved.revision,
      durationSeconds: 35,
    }),
  );
  vi.stubGlobal("fetch", fetch);
  await postCheckpoint("token", saved);
  expect(JSON.parse(fetch.mock.calls[0][1].body as string).timeZone).toBe(
    "Europe/Belgrade",
  );
  const next = createReadingTracker("next-book", clock);
  await next.start();
  expect(
    (await db.sessions.where("libraryItemId").equals("next-book").first())
      ?.timeZone,
  ).toBe("America/Los_Angeles");
  await next.stop();
});
