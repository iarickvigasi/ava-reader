import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("processes every item and reports completed count", async () => {
    const seen: number[] = [];
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n);
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(result).toEqual({ completed: 5, aborted: false });
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
      },
    );
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("counts a throwing worker as not-completed but keeps going", async () => {
    const result = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) {
        throw new Error("boom");
      }
    });
    expect(result.completed).toBe(2);
    expect(result.aborted).toBe(false);
  });

  it("aborts remaining items when shouldContinue turns false", async () => {
    const processed: number[] = [];
    let allow = 2;
    const result = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      1,
      async (n) => {
        processed.push(n);
        allow -= 1;
      },
      () => allow > 0,
    );
    expect(result.aborted).toBe(true);
    expect(processed.length).toBeLessThan(5);
  });
});
