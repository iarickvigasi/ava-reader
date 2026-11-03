import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { trackerFixture } from "./tracker-test-fixture";

it("includes foreground time spent waiting for the initial local save", async () => {
  const f = trackerFixture();
  const table = getDb().sessions;
  const put = table.put.bind(table);
  vi.spyOn(table, "put").mockImplementationOnce((row) => {
    f.advance(10_000);
    return put(row);
  });
  await f.tracker.start();
  f.advance(20_000);
  await f.tracker.stop();
  const [row] = await f.rows();
  expect(Date.parse(row.endedAt!) - Date.parse(row.startedAt)).toBe(30_000);
});
