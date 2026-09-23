import { expect, it } from "vitest";
import { composeMastery } from "./compose-mastery";

it("advances a stale seven-day window, preserving overlap and selecting actual today", () => {
  const baseline = {
    dailyGoalMinutes: 30,
    todayMinutes: 20,
    remainingMinutes: 10,
    days: [
      { key: "2026-04-06", minutes: 100, goalMet: true },
      { key: "2026-04-12", minutes: 20, goalMet: false },
    ],
  };
  const out = composeMastery(
    baseline,
    new Map([["2026-04-13", 600]]),
    30,
    "2026-04-13",
  );
  expect(out.days).toHaveLength(7);
  expect(out.days[0].key).toBe("2026-04-07");
  expect(out.days.slice(-2).map((day) => day.minutes)).toEqual([20, 10]);
  expect(out.todayMinutes).toBe(10);
  expect(out.remainingMinutes).toBe(20);
  const next = composeMastery(baseline, new Map(), 30, "2026-04-20");
  expect(next.days).toHaveLength(7);
  expect(next.days.every((day) => day.minutes === 0)).toBe(true);
  expect(next.todayMinutes).toBe(0);
});
