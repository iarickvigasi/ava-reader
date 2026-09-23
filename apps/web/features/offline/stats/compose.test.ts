import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomePayload } from "@/lib/api-types";

import {
  composeBookMinutesRead,
  composeHomeStats,
  composeMastery,
} from "./compose";

const baselineStats: HomePayload["stats"] = {
  aiComments: 5,
  highlights: 10,
  hoursReading: 8,
  volumesRead: 3,
};

const baselineMastery: HomePayload["mastery"] = {
  dailyGoalMinutes: 60,
  days: [
    { goalMet: false, key: "2026-04-06", minutes: 0 },
    { goalMet: true, key: "2026-04-07", minutes: 70 },
    { goalMet: false, key: "2026-04-08", minutes: 20 },
    { goalMet: false, key: "2026-04-09", minutes: 0 },
    { goalMet: false, key: "2026-04-10", minutes: 15 },
    { goalMet: false, key: "2026-04-11", minutes: 30 },
    { goalMet: false, key: "2026-04-12", minutes: 25 },
  ],
  remainingMinutes: 35,
  todayMinutes: 25,
};

describe("composeHomeStats", () => {
  it("adds floor(extraSeconds / 3600) to hoursReading", () => {
    const out = composeHomeStats(baselineStats, {
      hoursReadingExtraSeconds: 7200, // 2h
      highlightsNet: 0,
      volumesReadDelta: 0,
      aiCommentsNet: 0,
    });
    expect(out.hoursReading).toBe(10);
  });

  it("doesn't bump hoursReading when extraSeconds < 1h", () => {
    const out = composeHomeStats(baselineStats, {
      hoursReadingExtraSeconds: 3599,
      highlightsNet: 0,
      volumesReadDelta: 0,
      aiCommentsNet: 0,
    });
    expect(out.hoursReading).toBe(8);
  });

  it("adds volumesReadDelta to the server baseline", () => {
    const out = composeHomeStats(baselineStats, {
      hoursReadingExtraSeconds: 0,
      highlightsNet: 0,
      volumesReadDelta: 2,
      aiCommentsNet: 0,
    });
    expect(out.volumesRead).toBe(5);
  });

  it("leaves volumesRead at the baseline when the delta is zero", () => {
    const out = composeHomeStats(baselineStats, {
      hoursReadingExtraSeconds: 0,
      highlightsNet: 0,
      volumesReadDelta: 0,
      aiCommentsNet: 0,
    });
    expect(out.volumesRead).toBe(3);
  });

  it("subtracts removed completions and clamps the total at zero", () => {
    const deltas = {
      hoursReadingExtraSeconds: 0,
      highlightsNet: 0,
      aiCommentsNet: 0,
      volumesReadDelta: -1,
    };
    expect(composeHomeStats(baselineStats, deltas).volumesRead).toBe(2);
    expect(
      composeHomeStats(baselineStats, { ...deltas, volumesReadDelta: -10 })
        .volumesRead,
    ).toBe(0);
  });

  it("applies highlights net (positive and negative)", () => {
    expect(
      composeHomeStats(baselineStats, {
        hoursReadingExtraSeconds: 0,
        highlightsNet: 2,
        volumesReadDelta: 0,
        aiCommentsNet: 0,
      }).highlights,
    ).toBe(12);
    expect(
      composeHomeStats(baselineStats, {
        hoursReadingExtraSeconds: 0,
        highlightsNet: -3,
        volumesReadDelta: 0,
        aiCommentsNet: 0,
      }).highlights,
    ).toBe(7);
  });

  it("clamps highlights at zero — never shows negative", () => {
    expect(
      composeHomeStats(baselineStats, {
        hoursReadingExtraSeconds: 0,
        highlightsNet: -50,
        volumesReadDelta: 0,
        aiCommentsNet: 0,
      }).highlights,
    ).toBe(0);
  });

  it("returns the baseline unchanged when all deltas are zero", () => {
    expect(
      composeHomeStats(baselineStats, {
        hoursReadingExtraSeconds: 0,
        highlightsNet: 0,
        volumesReadDelta: 0,
        aiCommentsNet: 0,
      }),
    ).toEqual(baselineStats);
  });
});

describe("composeMastery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  it("adds minutes only to days present in the baseline window", () => {
    const out = composeMastery(
      baselineMastery,
      new Map([
        ["2026-04-12", 1200], // 20 min on today
        ["2026-04-11", 600], // 10 min yesterday
        ["2026-03-01", 9999], // outside window — ignored
      ]),
    );
    expect(out.days.map((day) => day.minutes)).toEqual([
      0, 70, 20, 0, 15, 40, 45,
    ]);
  });

  it("recomputes today's minutes + remaining vs the daily goal", () => {
    const out = composeMastery(
      baselineMastery,
      new Map([["2026-04-12", 2400]]), // +40 min today
    );
    expect(out.todayMinutes).toBe(65);
    expect(out.remainingMinutes).toBe(0); // goal met
  });

  it("flips goalMet on a day whose augmented minutes cross the goal", () => {
    const out = composeMastery(
      baselineMastery,
      new Map([["2026-04-11", 1800]]), // +30 min → 60 (goal)
    );
    const day = out.days.find((d) => d.key === "2026-04-11");
    expect(day?.minutes).toBe(60);
    expect(day?.goalMet).toBe(true);
  });

  it("preserves baseline rows when delta is zero / sub-minute", () => {
    const out = composeMastery(
      baselineMastery,
      new Map([["2026-04-08", 30]]), // 30 sec → 0 minute delta
    );
    const day = out.days.find((d) => d.key === "2026-04-08");
    expect(day).toEqual(
      baselineMastery.days.find((d) => d.key === "2026-04-08"),
    );
  });

  it("returns the baseline unchanged when the delta map is empty", () => {
    const out = composeMastery(baselineMastery, new Map());
    expect(out.days).toEqual(baselineMastery.days);
    expect(out.todayMinutes).toBe(baselineMastery.todayMinutes);
    expect(out.remainingMinutes).toBe(baselineMastery.remainingMinutes);
  });

  it("applies a lower goal to every day without changing recorded minutes", () => {
    const out = composeMastery(baselineMastery, new Map(), 20);

    expect(out.dailyGoalMinutes).toBe(20);
    expect(out.todayMinutes).toBe(25);
    expect(out.remainingMinutes).toBe(0);
    expect(out.days.map((day) => day.minutes)).toEqual(
      baselineMastery.days.map((day) => day.minutes),
    );
    expect(out.days.map((day) => day.goalMet)).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      true,
    ]);
    expect(baselineMastery.days.at(-1)?.goalMet).toBe(false);
  });

  it("clears goal completion when a higher goal exceeds recorded minutes", () => {
    const out = composeMastery(baselineMastery, new Map(), 90);

    expect(out.dailyGoalMinutes).toBe(90);
    expect(out.todayMinutes).toBe(25);
    expect(out.remainingMinutes).toBe(65);
    expect(out.days.map((day) => day.minutes)).toEqual(
      baselineMastery.days.map((day) => day.minutes),
    );
    expect(out.days.every((day) => !day.goalMet)).toBe(true);
    expect(baselineMastery.days[1].goalMet).toBe(true);
  });

  it("combines offline reading with an edited goal, including unchanged days", () => {
    const out = composeMastery(
      baselineMastery,
      new Map([
        ["2026-04-12", 600], // +10 min today → 35
        ["2026-04-10", 900], // +15 min → 30
      ]),
      30,
    );

    expect(out.dailyGoalMinutes).toBe(30);
    expect(out.todayMinutes).toBe(35);
    expect(out.remainingMinutes).toBe(0);
    expect(out.days.map((day) => day.minutes)).toEqual([
      0, 70, 20, 0, 30, 30, 35,
    ]);
    expect(out.days.map((day) => day.goalMet)).toEqual([
      false,
      true,
      false,
      false,
      true,
      true,
      true,
    ]);
  });
});

describe("composeBookMinutesRead", () => {
  it("adds floor(extraSeconds / 60) to the baseline minutes", () => {
    expect(composeBookMinutesRead(10, 120)).toBe(12);
    expect(composeBookMinutesRead(10, 59)).toBe(10);
    expect(composeBookMinutesRead(10, 0)).toBe(10);
  });

  it("treats negative extra as zero", () => {
    expect(composeBookMinutesRead(10, -60)).toBe(10);
  });
});
