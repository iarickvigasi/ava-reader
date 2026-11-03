import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { createReadingTracker } from "./tracker";
import { trackerFixture } from "./tracker-test-fixture";
import { fakeSessionLocks } from "./fake-session-locks";

it("hands ownership to the newly visible tab without waiting for the next heartbeat", async () => {
  const locks = fakeSessionLocks();
  const f = trackerFixture();
  await f.tracker.start();
  f.advance(20_000);
  const second = createReadingTracker("next", f.clock);
  const requested = locks.nextRequest();
  const start = second.start();
  await requested;
  await f.tracker.stop();
  await start;
  f.advance(15_000);
  await second.stop();
  const rows = await f.rows();
  expect(
    rows
      .map((row) => Date.parse(row.endedAt!) - Date.parse(row.startedAt))
      .sort(),
  ).toEqual([15_000, 20_000]);
});

it("cancels a start followed immediately by stop while another tab owns the lock", async () => {
  fakeSessionLocks();
  const f = trackerFixture();
  await f.tracker.start();
  const second = createReadingTracker("next", f.clock);
  await Promise.all([second.start(), second.stop()]);
  expect(await f.rows()).toHaveLength(1);
  await f.tracker.stop();
});

it("cancels a queued lock request when that tab hides", async () => {
  const locks = fakeSessionLocks();
  const f = trackerFixture();
  await f.tracker.start();
  const second = createReadingTracker("next", f.clock);
  const requested = locks.nextRequest();
  const start = second.start();
  await requested;
  await Promise.all([start, second.stop()]);
  await f.tracker.stop();
  expect(await f.rows()).toHaveLength(1);
});

it("recovers a crashed document immediately without counting the gap", async () => {
  const locks = fakeSessionLocks();
  const f = trackerFixture();
  await f.tracker.start();
  f.advance(30_000);
  await f.tracker.checkpoint();
  locks.destroyDocument();
  f.advance(10_000);
  const resumed = createReadingTracker("book", f.clock);
  await resumed.start();
  f.advance(20_000);
  await resumed.stop();
  const rows = await f.rows();
  expect(
    rows
      .map((row) => Date.parse(row.endedAt!) - Date.parse(row.startedAt))
      .sort(),
  ).toEqual([20_000, 30_000]);
});
