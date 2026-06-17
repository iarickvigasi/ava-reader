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
      progress: { done: 12, total: 12 },
    });
    expect(r.state).toEqual({ kind: "offline" });
    expect(r.completedAt).toBeNull();
    expect(r.timerMs).toBeNull();
  });

  it("Offline wins over in-progress priming", () => {
    const r = resolve({ online: false, progress: { done: 3, total: 12 } });
    expect(r.state).toEqual({ kind: "offline" });
  });

  it("shows nothing when there is nothing to prime (total 0)", () => {
    const r = resolve({ progress: { done: 0, total: 0 } });
    expect(r.state).toEqual({ kind: "none" });
  });

  it("shows the chip while priming is in progress, with no completion stamp", () => {
    const r = resolve({ progress: { done: 3, total: 12 } });
    expect(r.state).toEqual({ kind: "caching", done: 3, total: 12 });
    expect(r.completedAt).toBeNull();
    expect(r.timerMs).toBeNull();
  });

  it("resets a stale completion stamp if priming goes back in progress", () => {
    const r = resolve({ progress: { done: 4, total: 12 }, completedAt: 500 });
    expect(r.state).toEqual({ kind: "caching", done: 4, total: 12 });
    expect(r.completedAt).toBeNull();
  });

  it("stamps completion and dwells when priming finishes", () => {
    const r = resolve({ progress: { done: 12, total: 12 }, completedAt: null, now: 1000 });
    expect(r.state).toEqual({ kind: "caching", done: 12, total: 12 });
    expect(r.completedAt).toBe(1000);
    expect(r.timerMs).toBe(DWELL);
  });

  it("keeps showing the completed chip during the dwell window", () => {
    const r = resolve({ progress: { done: 12, total: 12 }, completedAt: 1000, now: 2000 });
    expect(r.state).toEqual({ kind: "caching", done: 12, total: 12 });
    expect(r.completedAt).toBe(1000);
    expect(r.timerMs).toBe(1000); // 2000 - (2000 - 1000)
  });

  it("hides the chip once the dwell window has elapsed", () => {
    const r = resolve({ progress: { done: 12, total: 12 }, completedAt: 1000, now: 3500 });
    expect(r.state).toEqual({ kind: "none" });
    expect(r.completedAt).toBeNull();
    expect(r.timerMs).toBeNull();
  });
});
