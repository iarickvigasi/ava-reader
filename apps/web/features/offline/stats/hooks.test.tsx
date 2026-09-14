import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { HomePayload } from "@/lib/api-types";
import { homeFixture } from "../buckets/home/test-fixture";
import { useComposedHomeStats } from "./hooks";

const cache = vi.hoisted(() => ({ home: null as HomePayload | null }));
vi.mock("../buckets/home/hooks", () => ({
  useHomeWithCache: (initial: HomePayload | null) => cache.home ?? initial,
}));
afterEach(() => { cache.home = null; });

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
