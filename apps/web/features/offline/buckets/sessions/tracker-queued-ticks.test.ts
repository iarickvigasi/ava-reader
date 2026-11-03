import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { createReadingTracker } from "./tracker";
import { trackerFixture } from "./tracker-test-fixture";
import { fakeSessionLocks } from "./fake-session-locks";

it("discards ticks queued before ownership instead of reopening or crediting the wait", async () => {
  const locks = fakeSessionLocks();
  const f = trackerFixture();
  await f.tracker.start();
  const second = createReadingTracker("next", f.clock);
  const requested = locks.nextRequest();
  const start = second.start();
  await requested;
  f.advance(30_000);
  const waitingTick = second.checkpoint();
  f.advance(30_000);
  await f.tracker.stop();
  await Promise.all([start, waitingTick]);
  f.advance(20_000);
  await second.stop();
  const rows = await f.rows();
  expect(rows).toHaveLength(2);
  const secondRow = rows.find((row) => row.libraryItemId === "next")!;
  expect(Date.parse(secondRow.endedAt!) - Date.parse(secondRow.startedAt)).toBe(
    20_000,
  );
});
