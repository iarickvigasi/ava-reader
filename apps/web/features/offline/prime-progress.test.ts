import { beforeEach, describe, expect, it } from "vitest";

// The prime-progress store is fed directly by the client-side background primer
// (no service-worker messaging) and read by the header chip. Plain JS so the
// primer (non-React) can write it. Mirrors net-state's subscribe/snapshot shape.

beforeEach(async () => {
  const { __resetPrimeProgressForTests } = await import("./prime-progress");
  __resetPrimeProgressForTests();
});

describe("prime-progress", () => {
  it("reports null before any progress is set", async () => {
    const { getPrimeProgress } = await import("./prime-progress");
    expect(getPrimeProgress()).toBeNull();
  });

  it("records progress and notifies subscribers", async () => {
    const { getPrimeProgress, setPrimeProgress, subscribeToPrimeProgress } =
      await import("./prime-progress");
    const seen: Array<{ done: number; total: number } | null> = [];
    subscribeToPrimeProgress(() => seen.push(getPrimeProgress()));
    setPrimeProgress({ done: 3, total: 12 });
    expect(getPrimeProgress()).toEqual({ done: 3, total: 12 });
    expect(seen).toEqual([{ done: 3, total: 12 }]);
  });

  it("clears progress and notifies when set back to null", async () => {
    const { getPrimeProgress, setPrimeProgress, subscribeToPrimeProgress } =
      await import("./prime-progress");
    setPrimeProgress({ done: 3, total: 12 });
    const seen: Array<{ done: number; total: number } | null> = [];
    subscribeToPrimeProgress(() => seen.push(getPrimeProgress()));
    setPrimeProgress(null);
    expect(getPrimeProgress()).toBeNull();
    expect(seen).toEqual([null]);
  });

  it("does not notify when the value is unchanged", async () => {
    const { setPrimeProgress, subscribeToPrimeProgress } = await import(
      "./prime-progress"
    );
    setPrimeProgress({ done: 5, total: 12 });
    const seen: unknown[] = [];
    subscribeToPrimeProgress(() => seen.push(1));
    setPrimeProgress({ done: 5, total: 12 });
    expect(seen).toEqual([]);
  });

  it("returns a referentially stable snapshot until the value changes", async () => {
    const { getPrimeProgress, setPrimeProgress } = await import(
      "./prime-progress"
    );
    setPrimeProgress({ done: 5, total: 12 });
    const first = getPrimeProgress();
    setPrimeProgress({ done: 5, total: 12 });
    expect(getPrimeProgress()).toBe(first);
    setPrimeProgress({ done: 6, total: 12 });
    expect(getPrimeProgress()).not.toBe(first);
  });
});
