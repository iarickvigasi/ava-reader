import { beforeEach, describe, expect, it } from "vitest";

// These tests exercise the real service worker (apps/web/public/sw.js) via
// the shared harness. The bug under test: Next link *prefetch* responses (a
// partial "loading" stub for a route with a loading.tsx) were cached under
// the same navigation key as a real navigation, so offline navigation to
// /app/library was served the stub and hung — URL changed, page stuck on the
// previous route. See docs/specs/14-route-precaching.md.

import {
  dispatchFetch,
  fakeRequest,
  loadServiceWorker,
  MockCache,
  ORIGIN,
  RSC_NAV_HEADERS,
  RSC_PREFETCH_HEADERS,
} from "./sw-test-harness";

const LIBRARY_RSC_KEY = `${ORIGIN}/app/library?__sw=rsc`;

describe("service worker fetch handler — prefetch must not poison the nav cache", () => {
  let sw: ReturnType<typeof loadServiceWorker>;
  let cache: MockCache;

  beforeEach(async () => {
    sw = loadServiceWorker();
    // The precache (or a prior real navigation) has stored the full RSC.
    cache = await sw.cacheStorage.open("ava-reader-sw-test");
    await cache.put(LIBRARY_RSC_KEY, new Response("FULL_LIBRARY_RSC", { status: 200 }));
  });

  it("does not overwrite the full RSC when a link prefetch arrives online", async () => {
    // Online prefetch of /app/library resolves to a partial "loading" stub.
    sw.fetchMock.mockResolvedValue(new Response("PREFETCH_STUB", { status: 200 }));

    await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_PREFETCH_HEADERS }),
    );

    const cached = await cache.match(LIBRARY_RSC_KEY);
    expect(await cached?.text()).toBe("FULL_LIBRARY_RSC");
  });

  it("serves the full RSC (not the stub) for an offline soft-navigation", async () => {
    // 1. Online: the link prefetch fires (partial stub).
    sw.fetchMock.mockResolvedValue(new Response("PREFETCH_STUB", { status: 200 }));
    await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_PREFETCH_HEADERS }),
    );

    // 2. Offline: the user clicks the library link (real navigation, no
    //    prefetch header). The network is unreachable.
    sw.fetchMock.mockRejectedValue(new Error("offline"));
    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_NAV_HEADERS }),
    );

    expect(await response?.text()).toBe("FULL_LIBRARY_RSC");
  });

  it("still caches a real navigation RSC response (bypass is prefetch-only)", async () => {
    sw.fetchMock.mockResolvedValue(new Response("FRESH_LIBRARY_RSC", { status: 200 }));

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_NAV_HEADERS }),
    );

    expect(await response?.text()).toBe("FRESH_LIBRARY_RSC");
    const cached = await cache.match(LIBRARY_RSC_KEY);
    expect(await cached?.text()).toBe("FRESH_LIBRARY_RSC");
  });
});
