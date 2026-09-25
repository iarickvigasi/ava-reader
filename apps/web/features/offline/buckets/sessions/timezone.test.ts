import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { beginLocalSession } from "./begin-local-session";
import { closeLocalSession, markSessionActive } from "./storage";
import { postSession } from "./post-session";
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
it("stores the start zone and preserves it after travel, heartbeat, close and replay", async () => {
  const identity = beginLocalSession("book");
  const db = getDb();
  // The write was queued before this transaction, so this read waits for it.
  expect((await db.sessions.get(identity.clientSessionId))?.timeZone).toBe(
    "Europe/Belgrade",
  );
  device.zone = "America/Los_Angeles";
  await markSessionActive(identity.clientSessionId, "2026-09-25T01:00:00Z");
  await closeLocalSession({
    clientSessionId: identity.clientSessionId,
    endedAt: "2026-09-25T01:00:00Z",
  });
  const saved = (await db.sessions.get(identity.clientSessionId))!;
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await postSession("token", "device", saved);
  expect(JSON.parse(fetch.mock.calls[0][1].body as string).timeZone).toBe(
    "Europe/Belgrade",
  );
  expect(beginLocalSession("next-book").timeZone).toBe("America/Los_Angeles");
  await db.sessions.toArray();
});
