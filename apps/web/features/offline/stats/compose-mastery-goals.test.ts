import { expect, it } from "vitest";
import { homeFixture } from "../buckets/home/test-fixture";
import { composeMastery } from "./compose-mastery";

const baseline = {
  ...homeFixture().mastery,
  dailyGoalMinutes: 60,
  days: [
    { key: "2026-04-11", minutes: 70, goalMet: true },
    { key: "2026-04-12", minutes: 25, goalMet: false },
  ],
  todayMinutes: 25,
  remainingMinutes: 35,
};

it.each([
  [20, 0, [true, true]],
  [60, 35, [true, false]],
  [90, 65, [false, false]],
] as const)(
  "recalculates goal %s without changing recorded minutes",
  (goal, remaining, met) => {
    const out = composeMastery(baseline, new Map(), goal, "2026-04-12");
    expect(out.dailyGoalMinutes).toBe(goal);
    expect(out.todayMinutes).toBe(25);
    expect(out.remainingMinutes).toBe(remaining);
    expect(out.days.slice(-2).map((day) => day.minutes)).toEqual([70, 25]);
    expect(out.days.slice(-2).map((day) => day.goalMet)).toEqual(met);
    expect(baseline.days.map((day) => day.goalMet)).toEqual([true, false]);
  },
);

it("combines recorded seconds with a changed goal and excludes days outside the window", () => {
  const out = composeMastery(
    baseline,
    new Map([
      ["2026-04-12", 600],
      ["2026-04-11", 30],
      ["2026-03-01", 9999],
    ]),
    30,
    "2026-04-12",
  );
  expect(out.days.map((day) => day.minutes)).toEqual([0, 0, 0, 0, 0, 70, 35]);
  expect(out.todayMinutes).toBe(35);
  expect(out.remainingMinutes).toBe(0);
  expect(out.days.slice(-2).every((day) => day.goalMet)).toBe(true);
});
