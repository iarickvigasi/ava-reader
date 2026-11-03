import { afterEach, expect, it, vi } from "vitest";
import { measureGridViewport } from "./measure-grid-viewport";
afterEach(() => vi.unstubAllGlobals());
it("reserves real toolbar height so admin buttons do not overlap the next virtual row", () => {
  vi.stubGlobal("window", { scrollY: 0, innerHeight: 800 });
  vi.stubGlobal("getComputedStyle", () => ({
    gridTemplateColumns: "200px 200px",
  }));
  let actionsHeight = 0;
  const grid = {
    getBoundingClientRect: () => ({ width: 420, top: 100 }),
    querySelector: () => ({
      getBoundingClientRect: () => ({ height: actionsHeight }),
    }),
  } as unknown as HTMLElement;
  const ordinary = measureGridViewport(grid)!;
  actionsHeight = 88;
  expect(measureGridViewport(grid)!.rowHeight).toBe(ordinary.rowHeight + 100);
});
