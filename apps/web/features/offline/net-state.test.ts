import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The net-state store reaches for `window` + `navigator`. The repo's vitest
// config doesn't bundle jsdom, so we stub the minimum needed. Mirrors the
// approach in features/offline/buckets/highlights/index.test.ts.

type Listener = (event?: unknown) => void;

function makeWindowStub() {
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
    dispatch: (event: string) => {
      const set = listeners.get(event);
      if (!set) return;
      for (const listener of set) {
        listener();
      }
    },
  };
}

let stub: ReturnType<typeof makeWindowStub>;

beforeEach(async () => {
  stub = makeWindowStub();
  vi.stubGlobal("window", stub);
  vi.stubGlobal("navigator", { onLine: true });
  const { __resetNetStateForTests } = await import("./net-state");
  __resetNetStateForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("net-state", () => {
  it("reports online by default", async () => {
    const { isOnline } = await import("./net-state");
    expect(isOnline()).toBe(true);
  });

  it("flips to offline on the offline event and notifies subscribers", async () => {
    const { isOnline, subscribeToNetworkState } = await import("./net-state");
    const seen: boolean[] = [];
    subscribeToNetworkState((value) => {
      seen.push(value);
    });
    // Touch isOnline so the store attaches its window listeners.
    isOnline();
    stub.dispatch("offline");
    expect(seen).toEqual([false]);
    expect(isOnline()).toBe(false);
  });

  it("flips back to online on the online event", async () => {
    const { isOnline, subscribeToNetworkState } = await import("./net-state");
    const seen: boolean[] = [];
    subscribeToNetworkState((value) => {
      seen.push(value);
    });
    isOnline();
    stub.dispatch("offline");
    stub.dispatch("online");
    expect(seen).toEqual([false, true]);
    expect(isOnline()).toBe(true);
  });

  it("does not double-notify when the value didn't change", async () => {
    const { isOnline, subscribeToNetworkState } = await import("./net-state");
    const seen: boolean[] = [];
    subscribeToNetworkState((value) => {
      seen.push(value);
    });
    isOnline();
    stub.dispatch("online");
    stub.dispatch("online");
    expect(seen).toEqual([]);
  });

  it("__setNetStateForTests pins the value and triggers listeners", async () => {
    const { isOnline, subscribeToNetworkState, __setNetStateForTests } =
      await import("./net-state");
    const seen: boolean[] = [];
    subscribeToNetworkState((value) => {
      seen.push(value);
    });
    isOnline();
    __setNetStateForTests(false);
    expect(seen).toEqual([false]);
    // While pinned, real events get coerced back to the override.
    stub.dispatch("online");
    expect(isOnline()).toBe(false);
    __setNetStateForTests(null);
  });
});
