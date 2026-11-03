import "fake-indexeddb/auto";
import { afterEach, vi } from "vitest";
import { __resetDbForTests, getDb } from "../../db";
import { createReadingTracker } from "./tracker";

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await getDb().delete();
  __resetDbForTests();
});

export function trackerFixture() {
  let wall = Date.now();
  let monotonic = 0;
  const clock = { wallNow: () => wall, monotonicNow: () => monotonic };
  return {
    clock,
    tracker: createReadingTracker("book", clock),
    advance: (milliseconds: number) => {
      wall += milliseconds;
      monotonic += milliseconds;
    },
    jumpWall: (milliseconds: number) => {
      wall += milliseconds;
    },
    rows: () => getDb().sessions.toArray(),
  };
}
