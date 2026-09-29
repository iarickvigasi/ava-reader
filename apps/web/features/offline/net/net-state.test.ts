import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let stub: EventTarget;

beforeEach(async () => {
  stub = new EventTarget();
  vi.stubGlobal("window", stub);
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ service: "ava-reader-api" })),
  );
  const { __resetNetStateForTests } = await import("./net-state");
  __resetNetStateForTests();
});

afterEach(async () => {
  const { __resetNetStateForTests } = await import("./net-state");
  __resetNetStateForTests();
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
    stub.dispatchEvent(new Event("offline"));
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
    stub.dispatchEvent(new Event("offline"));
    stub.dispatchEvent(new Event("online"));
    expect(isOnline()).toBe(false);
    const { checkNetworkReachability } = await import("./net-state");
    await checkNetworkReachability();
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
    stub.dispatchEvent(new Event("online"));
    stub.dispatchEvent(new Event("online"));
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
    stub.dispatchEvent(new Event("online"));
    expect(isOnline()).toBe(false);
    __setNetStateForTests(null);
  });
});
