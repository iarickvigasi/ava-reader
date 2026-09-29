import { afterEach, expect, it, vi } from "vitest";
import { composeHomeReading } from "./compose-home-reading";
import { composeHistory } from "@/features/home/compose-history";
import { homeFixture } from "../buckets/home/test-fixture";
import { readingSession } from "../buckets/home/reading-test-fixture";

const interval = {
  startedAt: "2026-09-24T22:10:00Z",
  endedAt: "2026-09-24T22:50:00Z",
  timeZone: "Europe/Belgrade",
};
const session = { ...readingSession, ...interval };
const empty = {
  version: 3 as const,
  timeZone: "Europe/Belgrade",
  intervals: [],
  legacyDays: [],
  days: [],
  totalSeconds: 0,
  clientSessionIds: [],
};
const included = {
  ...empty,
  intervals: [interval],
  totalSeconds: 2400,
  clientSessionIds: [session.clientSessionId],
};
afterEach(() => vi.useRealTimers());

it("keeps Friday minutes through both acknowledgment orders and stale snapshots", () => {
  vi.useFakeTimers().setSystemTime(new Date("2026-09-24T22:58:00Z"));
  for (const snapshot of [empty, included]) {
    for (const row of [
      session,
      {
        ...session,
        syncedAt: "2026-09-24T23:00:00Z",
        replayStatus: "acknowledged" as const,
      },
    ]) {
      const home = { ...homeFixture(), readingSnapshot: snapshot };
      const result = composeHomeReading(home, [row], "Europe/Belgrade");
      expect(result.mastery.days.at(-1)).toEqual({
        key: "2026-09-25",
        minutes: 40,
        goalMet: true,
      });
      expect(result.mastery.days.at(-2)?.minutes).toBe(0);
      expect(result.stats.hoursReading).toBe(0);
    }
  }
});
it("preserves Friday history after travel instead of reassigning it to Thursday", () => {
  vi.useFakeTimers().setSystemTime(new Date("2026-09-25T12:00:00Z"));
  const home = { ...homeFixture(), readingSnapshot: included };
  const local = composeHomeReading(home, [], "Europe/Belgrade");
  const travel = composeHomeReading(home, [], "America/Los_Angeles");
  expect(local.mastery.days.at(-1)?.key).toBe("2026-09-25");
  expect(travel.mastery.days.at(-1)).toEqual({
    key: "2026-09-25",
    minutes: 40,
    goalMet: true,
  });
  expect(travel.stats).toEqual(local.stats);
});
it("advances today at local midnight and uses the same history accounting", () => {
  const home = { ...homeFixture(), readingSnapshot: included };
  vi.useFakeTimers().setSystemTime(new Date("2026-09-24T21:59:59Z"));
  expect(
    composeHomeReading(home, [], "Europe/Belgrade").mastery.days.at(-1)?.key,
  ).toBe("2026-09-24");
  vi.setSystemTime(new Date("2026-09-24T22:00:00Z"));
  expect(
    composeHomeReading(home, [], "Europe/Belgrade").mastery.days.at(-1)?.key,
  ).toBe("2026-09-25");
  const page = {
    ...included,
    nextBefore: null,
    days: [{ key: "2026-09-25", seconds: 2400 }],
  };
  expect(composeHistory(page, [session], 30)).toEqual([
    { key: "2026-09-25", minutes: 40, goalMet: true },
  ]);
});
