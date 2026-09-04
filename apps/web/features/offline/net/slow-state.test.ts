import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// slow-state reaches for navigator.serviceWorker. The repo's vitest config
// doesn't bundle jsdom, so stub the minimum needed — mirrors net-state.test.ts.

type Listener = (event: unknown) => void;

function makeServiceWorkerStub() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    listeners,
    addEventListener: (event: string, listener: Listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
    },
    removeEventListener: (event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
    },
    dispatchMessage: (data: unknown) => {
      for (const listener of listeners.get("message") ?? []) {
        listener({ data });
      }
    },
  };
}

let serviceWorker: ReturnType<typeof makeServiceWorkerStub>;

beforeEach(async () => {
  serviceWorker = makeServiceWorkerStub();
  vi.stubGlobal("navigator", { serviceWorker });
  const { __resetSlowStateForTests } = await import("./slow-state");
  __resetSlowStateForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("slow-state", () => {
  it("reports not slow by default", async () => {
    const { isSlow } = await import("./slow-state");
    expect(isSlow()).toBe(false);
  });

  it("flips to slow on the SW's AVA_SLOW_CONNECTION message and notifies subscribers", async () => {
    const { isSlow, subscribeToSlowState } = await import("./slow-state");
    const seen: boolean[] = [];
    subscribeToSlowState((value) => seen.push(value));
    isSlow(); // touch it so the store attaches its SW listener
    serviceWorker.dispatchMessage({ type: "AVA_SLOW_CONNECTION" });
    expect(seen).toEqual([true]);
    expect(isSlow()).toBe(true);
  });

  it("ignores unrelated SW messages", async () => {
    const { isSlow } = await import("./slow-state");
    isSlow();
    serviceWorker.dispatchMessage({ type: "PRECACHE_ROUTES" });
    expect(isSlow()).toBe(false);
  });

  it("auto-clears a few seconds after the last signal", async () => {
    vi.useFakeTimers();
    const { isSlow, subscribeToSlowState } = await import("./slow-state");
    const seen: boolean[] = [];
    subscribeToSlowState((value) => seen.push(value));
    isSlow();
    serviceWorker.dispatchMessage({ type: "AVA_SLOW_CONNECTION" });
    expect(isSlow()).toBe(true);

    await vi.advanceTimersByTimeAsync(5_999);
    expect(isSlow()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(isSlow()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it("a second signal before decay restarts the timer instead of stacking", async () => {
    vi.useFakeTimers();
    const { isSlow } = await import("./slow-state");
    isSlow();
    serviceWorker.dispatchMessage({ type: "AVA_SLOW_CONNECTION" });
    await vi.advanceTimersByTimeAsync(4_000);
    serviceWorker.dispatchMessage({ type: "AVA_SLOW_CONNECTION" });
    await vi.advanceTimersByTimeAsync(4_000);
    // 8s since the first signal (would've decayed on its own), but only 4s
    // since the second — still slow.
    expect(isSlow()).toBe(true);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(isSlow()).toBe(false);
  });

  it("__reportSlowSignalForTests works without a real SW message", async () => {
    const { isSlow, __reportSlowSignalForTests } = await import("./slow-state");
    __reportSlowSignalForTests();
    expect(isSlow()).toBe(true);
  });
});
