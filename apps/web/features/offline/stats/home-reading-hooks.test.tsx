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
vi.mock("./use-highlight-count-delta", () => ({
  useHighlightCountDelta: () => 0,
}));
vi.mock("./use-reading-calendar", () => ({
  useReadingCalendar: () => "UTC|2026-04-13",
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
