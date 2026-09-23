import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { homeFixture } from "../buckets/home/test-fixture";
import { useComposedMastery } from "./hooks";

const clock = vi.hoisted(() => ({ todayKey: "2026-04-13" }));
vi.mock("./use-delta-bundle", () => ({
  useDeltaBundle: () => ({
    todayKey: clock.todayKey,
    sessions: { byUtcDaySeconds: new Map([["2026-04-13", 1800]]) },
  }),
}));
vi.mock("@/components/app/preferences/use-reading-goal", () => ({
  useReadingGoal: () => [30],
}));

it("uses the refreshed UTC date after hydration and on subsequent refreshes", () => {
  const home = homeFixture();
  home.mastery.days = [{ key: "2026-04-12", minutes: 20, goalMet: false }];
  function Probe() {
    const mastery = useComposedMastery(home);
    return (
      <output>
        {mastery?.days.at(-1)?.key}:{mastery?.todayMinutes}
      </output>
    );
  }
  expect(renderToStaticMarkup(<Probe />)).toBe(
    "<output>2026-04-13:30</output>",
  );
  clock.todayKey = "2026-04-14";
  expect(renderToStaticMarkup(<Probe />)).toBe("<output>2026-04-14:0</output>");
});
