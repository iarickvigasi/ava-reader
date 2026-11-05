import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { getDb } from "../../db";
import { createReadingTracker } from "./tracker";
import { recoverSessions } from "./recover-sessions";
import { SESSION_MAX_DURATION_MS } from "./constants";
import { trackerFixture } from "./tracker-test-fixture";

it("keeps another live lease, then recovers only its saved prefix after expiry", async () => {
  const f = trackerFixture();
  await f.tracker.start();
  f.advance(30_000);
  await f.tracker.checkpoint();
  const other = createReadingTracker("other", f.clock);
  await other.start();
  expect(await f.rows()).toHaveLength(1);
  await recoverSessions(getDb(), f.clock.wallNow());
  expect((await f.rows())[0].state).toBe("open");
  f.advance(91_000);
  await recoverSessions(getDb(), f.clock.wallNow());
  const [recovered] = await f.rows();
  expect(recovered.state).toBe("closed");
  expect(Date.parse(recovered.endedAt!) - Date.parse(recovered.startedAt)).toBe(
    30_000,
  );
  await other.start();
  f.advance(10_000);
  await other.stop();
  expect(await f.rows()).toHaveLength(2);
});

it("rotates a long foreground run before the server duration cap", async () => {
  const f = trackerFixture();
  await f.tracker.start();
  const [row] = await f.rows();
  await getDb().sessions.update(row.clientSessionId, {
    startedAt: new Date(
      f.clock.wallNow() - SESSION_MAX_DURATION_MS + 120_000,
    ).toISOString(),
  });
  f.advance(30_000);
  await f.tracker.checkpoint();
  const rows = await f.rows();
  expect(rows).toHaveLength(2);
  const closed = rows.find((session) => session.state === "closed")!;
  const open = rows.find((session) => session.state === "open")!;
  expect(closed.endedAt).toBe(open.startedAt);
  expect(Date.parse(closed.endedAt!) - Date.parse(closed.startedAt)).toBe(
    SESSION_MAX_DURATION_MS - 90_000,
  );
  await f.tracker.stop();
});
