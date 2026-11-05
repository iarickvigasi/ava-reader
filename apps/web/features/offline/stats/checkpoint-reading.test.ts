import { afterEach, expect, it, vi } from "vitest";
import { composeHomeReading } from "./compose-home-reading";
import { composeBookReading } from "./compose-book-reading";
import { composeHistory } from "@/features/home/compose-history";
import { checkpointHome, checkpointSession } from "./checkpoint-fixture";
import { uncoveredSessionDays } from "./uncovered-session-days";
import { indexReadingCoverage } from "./index-reading-coverage";

afterEach(() => vi.useRealTimers());

it("adds independent devices while preserving a partially acknowledged open session", () => {
  vi.useFakeTimers().setSystemTime(new Date("2026-11-03T12:00:00Z"));
  const session = checkpointSession(8);
  for (const covered of [0, 300, 480]) {
    const home = checkpointHome(covered);
    expect(
      composeHomeReading(home, [session], "UTC").mastery.todayMinutes,
    ).toBe(18);
    expect(composeBookReading(10, [session], home.readingSnapshot)).toBe(18);
    const history = { ...home.readingSnapshot!, nextBefore: null };
    expect(composeHistory(history, [session], 60)[0].minutes).toBe(18);
  }
});

it("uses each book snapshot's own coverage instead of its upload acknowledgment", () => {
  const session = checkpointSession(8);
  const snapshot = checkpointHome(300).readingSnapshot!;
  session.acknowledgedRevision = 8;
  expect(composeBookReading(15, [session], snapshot)).toBe(18);
  expect(
    composeBookReading(0, [session], { ...snapshot, totalSeconds: 300 }),
  ).toBe(8);
});

it("splits only the uncovered suffix across the saved timezone's midnight", () => {
  const row = {
    ...checkpointSession(8),
    startedAt: "2026-11-03T21:59:00Z",
    lastHeartbeatAt: "2026-11-03T22:02:00Z",
    timeZone: "Africa/Cairo",
  };
  const snapshot = {
    clientSessionIds: ["phone"],
    sessionCoverage: [{ clientSessionId: "phone", durationSeconds: 90 }],
  };
  expect([
    ...uncoveredSessionDays(row, indexReadingCoverage(snapshot)),
  ]).toEqual([["2026-11-04", 90]]);
  expect(composeBookReading(1, [row], { ...snapshot, totalSeconds: 90 })).toBe(
    3,
  );
});

it("distinguishes zero coverage from an older snapshot's complete ID coverage", () => {
  vi.useFakeTimers().setSystemTime(new Date("2026-11-03T12:00:00Z"));
  const home = checkpointHome(0);
  const snapshot = home.readingSnapshot!;
  snapshot.clientSessionIds.push("phone");
  const sessions = [checkpointSession(8)];
  for (const expected of [18, 10]) {
    expect(composeHomeReading(home, sessions, "UTC").mastery.todayMinutes).toBe(
      expected,
    );
    expect(composeBookReading(10, sessions, snapshot)).toBe(expected);
    expect(
      composeHistory({ ...snapshot, nextBefore: null }, sessions, 60)[0]
        .minutes,
    ).toBe(expected);
    delete snapshot.sessionCoverage;
  }
});

it("rounds after summing seconds and never resurrects dropped time", () => {
  const first = checkpointSession(0);
  first.lastHeartbeatAt = "2026-11-03T10:00:40Z";
  const second = { ...first, clientSessionId: "other" };
  expect(composeBookReading(0, [first, second])).toBe(1);
  first.dropped = true;
  expect(composeBookReading(0, [first, second])).toBe(0);
});

it("adds new recordings to an old offline cache", () => {
  vi.useFakeTimers().setSystemTime(new Date("2026-11-03T12:00:00Z"));
  const home = checkpointHome(0);
  delete home.readingSnapshot;
  home.mastery.days = [{ key: "2026-11-03", minutes: 10, goalMet: false }];
  const local = checkpointSession(8);
  expect(composeHomeReading(home, [local], "UTC").mastery.todayMinutes).toBe(
    18,
  );
});
