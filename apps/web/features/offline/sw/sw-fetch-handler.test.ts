import { beforeEach, describe, expect, it } from "vitest";

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
    sw.fetchMock.mockResolvedValue(
      new Response("FRESH_LIBRARY_RSC", { status: 200 }),
    );

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_NAV_HEADERS }),
    );

    expect(await response?.text()).toBe("FRESH_LIBRARY_RSC");
    expect(await cache.match(LIBRARY_RSC_KEY)).toBeUndefined();
  });

  it("lets an offline navigation RSC request fail instead of serving a stale payload", async () => {
    await cache.put(
      LIBRARY_RSC_KEY,
      new Response("MISMATCHED_RSC", { status: 200 }),
    );
    sw.fetchMock.mockRejectedValue(new Error("offline"));

    await expect(
      dispatchFetch(
        sw.listeners.fetch!,
        fakeRequest("/app/library", { headers: RSC_NAV_HEADERS }),
      ),
    ).rejects.toThrow("offline");
  });

  it("passes an RSC request identified by Accept alone through as well", async () => {
    sw.fetchMock.mockResolvedValue(new Response("RSC", { status: 200 }));

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", {
        headers: { accept: "text/x-component" },
      }),
    );

    expect(await response?.text()).toBe("RSC");
    expect(await cache.match(LIBRARY_RSC_KEY)).toBeUndefined();
  });

  it("still bypasses link prefetches", async () => {
    sw.fetchMock.mockResolvedValue(
      new Response("PREFETCH_STUB", { status: 200 }),
    );

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { headers: RSC_PREFETCH_HEADERS }),
    );

    expect(response).toBeUndefined();
    expect(await cache.match(LIBRARY_RSC_KEY)).toBeUndefined();
  });

  it("still caches and serves the document — the offline navigation target", async () => {
    sw.fetchMock.mockResolvedValue(
      new Response("LIBRARY_DOC", { status: 200 }),
    );
    await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { mode: "navigate" }),
    );
    expect(await (await cache.match(LIBRARY_DOC_KEY))?.text()).toBe(
      "LIBRARY_DOC",
    );

    sw.fetchMock.mockRejectedValue(new Error("offline"));
    const offline = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app/library", { mode: "navigate" }),
    );
    expect(await offline?.text()).toBe("LIBRARY_DOC");
  });
});
