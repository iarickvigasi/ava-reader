import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { trackerFixture } from "./tracker-test-fixture";

it("durably records five offline minutes plus the final remainder without any request", async () => {
  const f = trackerFixture();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await f.tracker.start();
  for (let n = 0; n < 10; n++) {
    f.advance(30_000);
    await f.tracker.checkpoint();
  }
  f.advance(17_000);
  await f.tracker.stop();
  const [row] = await f.rows();
  expect(Date.parse(row.endedAt!) - Date.parse(row.startedAt)).toBe(317_000);
  expect(row).toMatchObject({
    trackingVersion: 2,
    state: "closed",
    acknowledgedRevision: 0,
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("seals unexplained suspension at the durable checkpoint and starts a new run", async () => {
  const f = trackerFixture();
  await f.tracker.start();
  f.advance(30_000);
  await f.tracker.checkpoint();
  f.advance(120_000);
  await f.tracker.checkpoint();
  f.advance(15_000);
  await f.tracker.stop();
  const rows = await f.rows();
  const durations = rows
    .map((row) => Date.parse(row.endedAt!) - Date.parse(row.startedAt))
    .sort();
  expect(durations).toEqual([15_000, 30_000]);
});

it("does not turn a wall-clock jump into reading time", async () => {
  const f = trackerFixture();
  await f.tracker.start();
  f.advance(30_000);
  await f.tracker.checkpoint();
  f.jumpWall(60_000);
  await f.tracker.checkpoint();
  await f.tracker.stop();
  expect(
    (await f.rows()).reduce(
      (sum, row) => sum + Date.parse(row.endedAt!) - Date.parse(row.startedAt),
      0,
    ),
  ).toBe(30_000);
});

it("repeated start/stop calls keep one session and do not reopen it", async () => {
  const f = trackerFixture();
  await f.tracker.start();
  await f.tracker.start();
  f.advance(12_000);
  await Promise.all([f.tracker.stop(), f.tracker.stop()]);
  const rows = await f.rows();
  expect(rows).toHaveLength(1);
  expect(Date.parse(rows[0].endedAt!) - Date.parse(rows[0].startedAt)).toBe(
    12_000,
  );
});

it("silently retries failed persistence on the next checkpoint", async () => {
  const f = trackerFixture();
  const write = vi
    .spyOn(getDb().sessions, "put")
    .mockRejectedValueOnce(new Error("quota"));
  await f.tracker.start();
  expect(await f.rows()).toHaveLength(0);
  write.mockRestore();
  f.advance(30_000);
  await f.tracker.checkpoint();
  f.advance(20_000);
  await f.tracker.stop();
  const [row] = await f.rows();
  expect(Date.parse(row.endedAt!) - Date.parse(row.startedAt)).toBe(20_000);
});
