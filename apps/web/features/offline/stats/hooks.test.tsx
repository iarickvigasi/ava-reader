import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { HomePayload } from "@/lib/api-types";
import { homeFixture } from "../buckets/home/test-fixture";
import { useComposedHomeStats, useComposedMastery } from "./hooks";

const cache = vi.hoisted(() => ({ home: null as HomePayload | null }));
const preferences = vi.hoisted(() => ({ goal: undefined as number | undefined }));
vi.mock("../buckets/home/hooks", () => ({
  useHomeWithCache: (initial: HomePayload | null) => cache.home ?? initial,
}));
vi.mock("@/components/app/preferences/use-reading-goal", () => ({
  useReadingGoal: (defaultValue = 60) => [preferences.goal ?? defaultValue, () => {}],
}));
afterEach(() => {
  cache.home = null;
  preferences.goal = undefined;
});

it("uses the live effective completion total without adding it to the initial total again", () => {
  const initial = homeFixture();
  cache.home = { ...initial, stats: { ...initial.stats, volumesRead: 4 } };
  function Probe() {
    const stats = useComposedHomeStats(initial);
    return <output>{JSON.stringify(stats)}</output>;
  }
  expect(renderToStaticMarkup(<Probe />)).toBe(
    renderToStaticMarkup(<output>{JSON.stringify(cache.home.stats)}</output>),
  );
});

it("keeps the initial server total for the first render before a cache read", () => {
  const initial = homeFixture();
  function Probe() {
    const stats = useComposedHomeStats(initial);
    return <output>{JSON.stringify(stats)}</output>;
  }
  expect(renderToStaticMarkup(<Probe />)).toBe(
    renderToStaticMarkup(<output>{JSON.stringify(initial.stats)}</output>),
  );
});

function MasteryProbe({ home }: { home: HomePayload | null }) {
  const mastery = useComposedMastery(home);
  return <output>{JSON.stringify(mastery)}</output>;
}

it("keeps the home payload goal until the saved reading goal loads", () => {
  const initial = homeFixture();
  expect(initial.mastery.dailyGoalMinutes).toBe(30);

  expect(renderToStaticMarkup(<MasteryProbe home={initial} />)).toBe(
    renderToStaticMarkup(<output>{JSON.stringify(initial.mastery)}</output>),
  );
});

it("recalculates mastery from the reading preference when no reading delta exists", () => {
  const initial = homeFixture();
  initial.mastery = {
    dailyGoalMinutes: 30,
    days: [{ key: "2026-04-12", minutes: 20, goalMet: false }],
    remainingMinutes: 10,
    todayMinutes: 20,
  };
  preferences.goal = 15;

  expect(renderToStaticMarkup(<MasteryProbe home={initial} />)).toBe(
    renderToStaticMarkup(<output>{JSON.stringify({
      ...initial.mastery,
      dailyGoalMinutes: 15,
      days: [{ key: "2026-04-12", minutes: 20, goalMet: true }],
      remainingMinutes: 0,
    })}</output>),
  );

  preferences.goal = 45;
  expect(renderToStaticMarkup(<MasteryProbe home={initial} />)).toBe(
    renderToStaticMarkup(<output>{JSON.stringify({
      ...initial.mastery,
      dailyGoalMinutes: 45,
      remainingMinutes: 25,
    })}</output>),
  );
});

it("returns no mastery until a home payload is available", () => {
  preferences.goal = 45;
  expect(renderToStaticMarkup(<MasteryProbe home={null} />)).toBe(
    renderToStaticMarkup(<output>null</output>),
  );
});
