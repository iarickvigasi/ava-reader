import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A document fetch that hasn't responded within SLOW_DOC_TIMEOUT_MS falls
// back to any cached copy immediately instead of blocking the navigation,
// and tells every open tab the connection looks slow — the client's "Slow"
// badge (spec 4.10-slow-connection) is driven by that broadcast. The
// deferred network fetch keeps running in the background to refresh the
// cache. See docs/specs/4-offline/4.5-route-precaching.md §10.

import {
  dispatchFetch,
  fakeRequest,
  loadServiceWorker,
  MockCache,
  ORIGIN,
} from "./sw-test-harness";

const LIBRARY_DOC_KEY = `${ORIGIN}/app/library?__sw=doc`;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("service worker — slow-connection fallback", () => {
  let sw: ReturnType<typeof loadServiceWorker>;
  let cache: MockCache;

  beforeEach(async () => {
    sw = loadServiceWorker();
    cache = await sw.cacheStorage.open("ava-reader-sw-test");
  });

  it("serves a cached doc once the network is stuck past the timeout, and tells open tabs", async () => {
    await cache.put(LIBRARY_DOC_KEY, new Response("CACHED_LIBRARY", { status: 200 }));
    sw.fetchMock.mockReturnValue(new Promise<Response>(() => {})); // never settles

    const pending = dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { mode: "navigate" }),
    );
    await vi.advanceTimersByTimeAsync(3_000);
    const response = await pending;

    expect(await response?.text()).toBe("CACHED_LIBRARY");
    // The broadcast is fire-and-forget (event.waitUntil, not awaited by the
    // response) — switch to real timers so its own microtask chain
    // (self.clients.matchAll → postMessage) gets to run before asserting.
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sw.clientPostMessage).toHaveBeenCalledWith({
      type: "AVA_SLOW_CONNECTION",
    });
  });

  it("never falls back on a normal-speed load — the fresh response wins and is cached", async () => {
    sw.fetchMock.mockResolvedValue(new Response("FRESH_LIBRARY", { status: 200 }));

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { mode: "navigate" }),
    );

    expect(await response?.text()).toBe("FRESH_LIBRARY");
    expect(sw.clientPostMessage).not.toHaveBeenCalled();
    expect(await (await cache.match(LIBRARY_DOC_KEY))?.text()).toBe("FRESH_LIBRARY");
  });

  it("with no cache yet, a slow first-ever visit just keeps waiting on the network", async () => {
    let resolveFetch!: (response: Response) => void;
    sw.fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const pending = dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { mode: "navigate" }),
    );
    await vi.advanceTimersByTimeAsync(3_000);
    // Past the timeout, still nothing cached — no fallback fired.
    expect(sw.clientPostMessage).not.toHaveBeenCalled();

    resolveFetch(new Response("LATE_LIBRARY", { status: 200 }));
    const response = await pending;
    expect(await response?.text()).toBe("LATE_LIBRARY");
  });
});
