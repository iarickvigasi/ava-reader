import { describe, expect, it } from "vitest";

import { resolveHeaderChip } from "./header-chip-state";

const DWELL = 2000;

function resolve(
  overrides: Partial<Parameters<typeof resolveHeaderChip>[0]> = {},
) {
  return resolveHeaderChip({
    online: true,
    progress: null,
    completedAt: null,
    now: 1000,
    dwellMs: DWELL,
    shellsReady: true,
    ...overrides,
  });
}

describe("resolveHeaderChip", () => {
  it("shows nothing when online with no priming in progress", () => {
    expect(resolve()).toEqual({
      state: { kind: "none" },
      completedAt: null,
      timerMs: null,
    });
  });

  it("shows the Offline chip and clears any dwell when offline", () => {
    const r = resolve({
      online: false,
      completedAt: 500,
      progress: { phase: "ready" },
    });
    expect(r.state).toEqual({ kind: "offline" });
    expect(r.completedAt).toBeNull();
    expect(r.timerMs).toBeNull();
  });

  it("Offline wins over in-progress priming", () => {
    const r = resolve({
      online: false,
      progress: { phase: "content", done: 3, total: 12 },
    });
    expect(r.state).toEqual({ kind: "offline" });
  });

  it("shows the Caching chip during the content tier", () => {
    const r = resolve({ progress: { phase: "content", done: 3, total: 5 } });
    expect(r.state).toEqual({ kind: "caching", done: 3, total: 5 });
    expect(r.completedAt).toBeNull();
    expect(r.timerMs).toBeNull();
  });

  it("shows nothing during a content tier with no marked books (total 0)", () => {
    const r = resolve({ progress: { phase: "content", done: 0, total: 0 } });
    expect(r.state).toEqual({ kind: "none" });
  });

  it("stamps completion and dwells when ready", () => {
    const r = resolve({ progress: { phase: "ready" }, completedAt: null, now: 1000 });
    expect(r.state).toEqual({ kind: "ready" });
    expect(r.completedAt).toBe(1000);
    expect(r.timerMs).toBe(DWELL);
  });

  it("holds (shows nothing) when priming is ready but route shells aren't cached yet", () => {
    const r = resolve({ progress: { phase: "ready" }, shellsReady: false });
    expect(r.state).toEqual({ kind: "none" });
    expect(r.completedAt).toBeNull();
    expect(r.timerMs).toBeNull();
  });

  it("still shows the Caching chip regardless of shell readiness", () => {
    const r = resolve({
      progress: { phase: "content", done: 2, total: 5 },
      shellsReady: false,
    });
    expect(r.state).toEqual({ kind: "caching", done: 2, total: 5 });
  });

  it("keeps showing the ready chip during the dwell window", () => {
    const r = resolve({ progress: { phase: "ready" }, completedAt: 1000, now: 2000 });
    expect(r.state).toEqual({ kind: "ready" });
    expect(r.completedAt).toBe(1000);
    expect(r.timerMs).toBe(1000); // 2000 - (2000 - 1000)
  });

  it("hides the chip once the ready dwell window has elapsed", () => {
    const r = resolve({ progress: { phase: "ready" }, completedAt: 1000, now: 3500 });
    expect(r.state).toEqual({ kind: "none" });
    expect(r.completedAt).toBeNull();
    expect(r.timerMs).toBeNull();
  });
});
