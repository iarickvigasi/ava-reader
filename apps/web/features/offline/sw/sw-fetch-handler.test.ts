import { beforeEach, describe, expect, it } from "vitest";

// These tests exercise the real service worker (apps/web/public/sw.js) via
// the shared harness.
//
// The contract under test: RSC payloads are never cached and never served
// from cache. They vary by the router state tree the request carries (the
// server says so — `Vary: next-router-state-tree`), so one entry per pathname
// is unsound: the stored payload answers a *different* question than the one
// being asked. Handing the router a mismatched 200 strands the navigation —
// URL changed, previous page still painted, no error, no fallback. Letting
// the request fail instead triggers Next's hard navigation onto the cached
// document, which is what makes offline navigation work.
// See docs/specs/4-offline/4.5-route-precaching.md §5.

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
const LIBRARY_DOC_KEY = `${ORIGIN}/app/library?__sw=doc`;

describe("service worker fetch handler — RSC payloads are not cached", () => {
  let sw: ReturnType<typeof loadServiceWorker>;
  let cache: MockCache;

  beforeEach(async () => {
    sw = loadServiceWorker();
    cache = await sw.cacheStorage.open("ava-reader-sw-test");
  });

  it("passes a navigation RSC request through without touching the cache", async () => {
    sw.fetchMock.mockResolvedValue(new Response("FRESH_LIBRARY_RSC", { status: 200 }));

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_NAV_HEADERS }),
    );

    // Not intercepted at all — the browser performs the fetch itself.
    expect(response).toBeUndefined();
    expect(await cache.match(LIBRARY_RSC_KEY)).toBeUndefined();
  });

  it("lets an offline navigation RSC request fail instead of serving a stale payload", async () => {
    // A payload left over from an older build or an earlier arrival path.
    await cache.put(LIBRARY_RSC_KEY, new Response("MISMATCHED_RSC", { status: 200 }));
    sw.fetchMock.mockRejectedValue(new Error("offline"));

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_NAV_HEADERS }),
    );

    // The failure is what makes Next hard-navigate onto the cached document.
    expect(response).toBeUndefined();
  });

  it("passes an RSC request identified by Accept alone through as well", async () => {
    sw.fetchMock.mockResolvedValue(new Response("RSC", { status: 200 }));

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", {
        headers: { accept: "text/x-component" },
      }),
    );

    expect(response).toBeUndefined();
    expect(await cache.match(LIBRARY_RSC_KEY)).toBeUndefined();
  });

  it("still bypasses link prefetches", async () => {
    sw.fetchMock.mockResolvedValue(new Response("PREFETCH_STUB", { status: 200 }));

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_PREFETCH_HEADERS }),
    );

    expect(response).toBeUndefined();
    expect(await cache.match(LIBRARY_RSC_KEY)).toBeUndefined();
  });

  it("still caches and serves the document — the offline navigation target", async () => {
    sw.fetchMock.mockResolvedValue(new Response("LIBRARY_DOC", { status: 200 }));
    await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { mode: "navigate" }),
    );
    expect(await (await cache.match(LIBRARY_DOC_KEY))?.text()).toBe("LIBRARY_DOC");

    sw.fetchMock.mockRejectedValue(new Error("offline"));
    const offline = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { mode: "navigate" }),
    );
    expect(await offline?.text()).toBe("LIBRARY_DOC");
  });
});
