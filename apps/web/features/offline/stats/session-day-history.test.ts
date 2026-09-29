import { expect, it } from "vitest";
import { readingSnapshotDays } from "./reading-snapshot";

const interval = {
  startedAt: "2026-09-24T22:10:00Z",
  endedAt: "2026-09-24T22:50:00Z",
};
it("groups mixed-zone sessions by their own saved zones", () => {
  const days = readingSnapshotDays({
    version: 3,
    days: [],
    legacyDays: [],
    intervals: [
      { ...interval, timeZone: "Europe/Belgrade" },
      { ...interval, timeZone: "America/Los_Angeles" },
    ],
  });
  expect([...days]).toEqual([
    ["2026-09-25", 2400],
    ["2026-09-24", 2400],
  ]);
});
it("retains older cache allocations without inferring a session timezone", () => {
  const days = readingSnapshotDays({
    version: 2,
    timeZone: "Europe/Belgrade",
    days: [{ key: "2026-09-25", seconds: 2400 }],
    intervals: [interval],
  });
  expect([...days]).toEqual([["2026-09-25", 2400]]);
  expect([
    ...readingSnapshotDays({ version: 3, days: [], intervals: [interval] }),
  ]).toEqual([["2026-09-24", 2400]]);
});
