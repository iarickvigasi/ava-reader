import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { trackerFixture } from "./tracker-test-fixture";
import { syncPendingSessions } from "./sync";
import { needsSessionSync } from "./needs-session-sync";

it("retries an open404 after deletion and uploads the final closed run", async () => {
  const f = trackerFixture();
  await f.tracker.start();
  f.advance(30_000);
  await f.tracker.checkpoint();
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  await syncPendingSessions(async () => "token");
  expect(needsSessionSync((await f.rows())[0])).toBe(true);
  await f.tracker.stop();
  const [closed] = await f.rows();
  fetch.mockResolvedValue(
    Response.json({
      sessionId: "remote",
      revision: closed.revision,
      durationSeconds: 30,
    }),
  );
  await syncPendingSessions(async () => "token");
  expect(needsSessionSync((await f.rows())[0])).toBe(false);
});

it("does not discard a newer checkpoint when an older request is rejected", async () => {
  const f = trackerFixture();
  await f.tracker.start();
  let reply!: (response: Response) => void;
  let requested!: () => void;
  const sent = new Promise<void>((resolve) => {
    requested = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      requested();
      return new Promise<Response>((resolve) => {
        reply = resolve;
      });
    }),
  );
  const upload = syncPendingSessions(async () => "token");
  await sent;
  f.advance(30_000);
  await f.tracker.stop();
  reply(new Response(null, { status: 400 }));
  await upload;
  expect(needsSessionSync((await f.rows())[0])).toBe(true);
});
