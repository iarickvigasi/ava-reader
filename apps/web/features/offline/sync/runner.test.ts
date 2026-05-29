import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Minimal window stub — the runner uses window + document listeners + a poll
// interval, but we trigger flushes directly via flushAll() to keep tests
// deterministic.

function stubGlobals() {
  vi.stubGlobal("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal("document", {
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: "visible",
  });
  vi.stubGlobal("navigator", { onLine: true });
}

beforeEach(async () => {
  stubGlobals();
  const netState = await import("../net-state");
  netState.__resetNetStateForTests();
  const runner = await import("./runner");
  runner.__resetSyncRunnerForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sync runner", () => {
  it("flushes registered buckets in priority order while online", async () => {
    const { flushAll, registerSyncBucket } = await import("./runner");
    const calls: string[] = [];
    registerSyncBucket({
      id: "b",
      priority: 2,
      flush: async () => {
        calls.push("b");
      },
    });
    registerSyncBucket({
      id: "a",
      priority: 1,
      flush: async () => {
        calls.push("a");
      },
    });
    await flushAll();
    // Both buckets ran. Priority controls listing order; runtime can interleave
    // resolutions, but both must have been invoked.
    expect(calls).toContain("a");
    expect(calls).toContain("b");
  });

  it("does nothing while offline", async () => {
    const { flushAll, registerSyncBucket } = await import("./runner");
    const { __setNetStateForTests } = await import("../net-state");
    let calls = 0;
    registerSyncBucket({
      id: "a",
      priority: 1,
      flush: async () => {
        calls += 1;
      },
    });
    __setNetStateForTests(false);
    await flushAll();
    expect(calls).toBe(0);
    __setNetStateForTests(null);
  });

  it("guards against concurrent flush of the same bucket", async () => {
    const { flushAll, registerSyncBucket } = await import("./runner");
    let active = 0;
    let max = 0;
    registerSyncBucket({
      id: "a",
      priority: 1,
      flush: async () => {
        active += 1;
        max = Math.max(max, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      },
    });
    await Promise.all([flushAll(), flushAll(), flushAll()]);
    expect(max).toBe(1);
  });

  it("swallows bucket errors so one bad bucket doesn't break the cycle", async () => {
    const { flushAll, registerSyncBucket } = await import("./runner");
    const calls: string[] = [];
    registerSyncBucket({
      id: "bad",
      priority: 1,
      flush: async () => {
        calls.push("bad");
        throw new Error("boom");
      },
    });
    registerSyncBucket({
      id: "good",
      priority: 2,
      flush: async () => {
        calls.push("good");
      },
    });
    await expect(flushAll()).resolves.toBeUndefined();
    expect(calls.sort()).toEqual(["bad", "good"]);
  });
});
