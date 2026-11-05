import { afterEach, expect, it, vi } from "vitest";
import type { SessionRow } from "../db";
import { homeFixture } from "../buckets/home/test-fixture";
import { composeHomeReading } from "./compose-home-reading";
import { composeBookReading } from "./compose-book-reading";

const session: SessionRow = {
  clientSessionId: "midnight",
  libraryItemId: "book",
  trackingVersion: 2,
  revision: 1,
  acknowledgedRevision: 0,
  startedAt: "2026-04-12T23:40:00Z",
  endedAt: "2026-04-13T00:30:00Z",
  lastHeartbeatAt: "2026-04-13T00:30:00Z",
  timeZone: "UTC",
  state: "closed",
};
afterEach(() => vi.useRealTimers());

it("preserves both midnight dates through partial and full snapshot coverage", () => {
  vi.useFakeTimers().setSystemTime(new Date("2026-04-13T12:00:00Z"));
  for (const seconds of [0, 1200, 3000]) {
    const home = homeFixture();
    home.readingSnapshot = {
      totalSeconds: seconds,
      clientSessionIds: seconds ? [session.clientSessionId] : [],
      sessionCoverage: [
        { clientSessionId: session.clientSessionId, durationSeconds: seconds },
      ],
      days: [
        { key: "2026-04-12", seconds: Math.min(seconds, 1200) },
        { key: "2026-04-13", seconds: Math.max(0, seconds - 1200) },
      ],
    };
    const result = composeHomeReading(home, [session], "UTC");
    expect(result.mastery.days.slice(-2)).toEqual([
      { key: "2026-04-12", minutes: 20, goalMet: false },
      { key: "2026-04-13", minutes: 30, goalMet: true },
    ]);
    expect(result.mastery.todayMinutes).toBe(30);
    expect(result.mastery.remainingMinutes).toBe(0);
    expect(composeBookReading(0, [session], home.readingSnapshot)).toBe(50);
  }
});

it("keeps book, day and overall totals consistent when capping overlong recordings", () => {
  vi.useFakeTimers().setSystemTime(new Date("2026-04-13T12:00:00Z"));
  const rows = [
    session,
    {
      ...session,
      clientSessionId: "long",
      endedAt: "2026-04-15T00:30:00Z",
    },
  ];
  const result = composeHomeReading(homeFixture(), rows, "UTC");
  expect(result.mastery.days.slice(-2).map((day) => day.minutes)).toEqual([
    40, 1450,
  ]);
  expect(result.stats.hoursReading).toBe(24);
  expect(composeBookReading(0, rows)).toBe(1490);
});
