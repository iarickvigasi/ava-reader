import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { homeFixture } from "../buckets/home/test-fixture";
import { useComposedHomeStats, useComposedMastery } from "./hooks";

vi.mock("../buckets/home/hooks", () => ({
  useHomeWithCache: () => ({
    stats: { hoursReading: 1, highlights: 0, aiComments: 0, volumesRead: 0 },
    mastery: {
      dailyGoalMinutes: 60,
      todayMinutes: 30,
      remainingMinutes: 30,
      days: [{ key: "2026-04-13", minutes: 30, goalMet: false }],
    },
  }),
}));
vi.mock("./use-delta-bundle", () => ({
  useDeltaBundle: () => ({
    todayKey: "2026-04-13",
    highlightsNet: 0,
    sessions: {
      totalSeconds: 3600,
      byUtcDaySeconds: new Map([["2026-04-13", 1800]]),
    },
  }),
}));
vi.mock("@/components/app/preferences/use-reading-goal", () => ({
  useReadingGoal: () => [60],
}));

it("uses reconciled hours and mastery from the cache without adding stale deltas", () => {
  function Probe() {
    const home = homeFixture();
    const stats = useComposedHomeStats(home);
    const mastery = useComposedMastery(home);
    return (
      <output>
        {stats?.hoursReading}:{mastery?.todayMinutes}
      </output>
    );
  }
  expect(renderToStaticMarkup(<Probe />)).toBe("<output>1:30</output>");
});
