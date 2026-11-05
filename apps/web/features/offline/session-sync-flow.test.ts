import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "./db";
import { applyHome, readHome } from "./buckets/home/storage";
import { syncPendingSessions } from "./buckets/sessions/sync";
import { sessionFlowFixture } from "./session-flow-fixture";

vi.mock("./stats/device-time-zone", () => ({ deviceTimeZone: () => "UTC" }));
vi.mock("./buckets/home/revalidate", () => ({ revalidateHome: vi.fn() }));

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps both devices' time while reconnect uploads an earlier open checkpoint", async () => {
  const flow = sessionFlowFixture();
  await applyHome(flow.home());
  await flow.tracker.start();
  await flow.read(5);
  expect((await readHome())?.mastery.todayMinutes).toBe(15);
  const [phone] = await getDb().sessions.toArray();
  let reply!: (response: Response) => void;
  let sent!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    sent = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      sent();
      return new Promise<Response>((resolve) => {
        reply = resolve;
      });
    }),
  );
  const upload = syncPendingSessions(async () => "token");
  await requestStarted;
  await flow.read(1);
  reply(
    Response.json({
      sessionId: "server-phone",
      revision: phone.revision,
      durationSeconds: 300,
    }),
  );
  await upload;
  const newer = await getDb().sessions.get(phone.clientSessionId);
  expect(newer!.revision).toBeGreaterThan(newer!.acknowledgedRevision!);
  await applyHome(flow.home(phone.clientSessionId, 300, 2));
  expect((await readHome())?.mastery.todayMinutes).toBe(16);
  await flow.read(2);
  await flow.tracker.stop();
  expect((await readHome())?.mastery.todayMinutes).toBe(18);
  const final = (await getDb().sessions.get(phone.clientSessionId))!;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        sessionId: "server-phone",
        revision: final.revision,
        durationSeconds: 480,
      }),
    ),
  );
  await syncPendingSessions(async () => "token");
  await applyHome(flow.home(phone.clientSessionId, 480, 3));
  await applyHome(flow.home(phone.clientSessionId, 300, 2));
  getDb().close();
  await getDb().open();
  expect((await readHome())?.mastery.todayMinutes).toBe(18);
  expect(await getDb().sessions.count()).toBe(1);
});
