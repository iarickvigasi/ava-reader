import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests exercise the real service worker (apps/web/public/sw.js) by
// evaluating it inside a minimal mock of the ServiceWorkerGlobalScope, so the
// fetch-handler's cache strategy is covered without a browser. The bug under
// test: Next link *prefetch* responses (a partial "loading" stub for a route
// with a loading.tsx) were cached under the same navigation key as a real
// navigation, so offline navigation to /app/library was served the stub and
// hung — URL changed, page stuck on the previous route. See
// docs/specs/14-route-precaching.md.

const SW_SOURCE = readFileSync(
  fileURLToPath(new URL("../../../public/sw.js", import.meta.url)),
  "utf8",
);

const ORIGIN = "https://avareader.space";
const LIBRARY_RSC_KEY = `${ORIGIN}/app/library?__sw=rsc`;

// A Cache backed by a Map keyed on the request URL string (navigationCacheKey
// hands the SW real URL strings as keys).
class MockCache {
  store = new Map<string, Response>();
  #key(req: Request | string) {
    return typeof req === "string" ? req : req.url;
  }
  async match(req: Request | string) {
    const hit = this.store.get(this.#key(req));
    return hit ? hit.clone() : undefined;
  }
  async put(req: Request | string, res: Response) {
    this.store.set(this.#key(req), res);
  }
  async keys() {
    return [...this.store.keys()];
  }
  async delete(req: Request | string) {
    return this.store.delete(this.#key(req));
  }
}

class MockCacheStorage {
  caches = new Map<string, MockCache>();
  async open(name: string) {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MockCache();
      this.caches.set(name, cache);
    }
    return cache;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
}

type FetchHandler = (event: unknown) => void;

function loadServiceWorker() {
  const listeners: Record<string, FetchHandler> = {};
  const self = {
    location: new URL(`${ORIGIN}/sw.js?v=test`),
    addEventListener: (type: string, handler: FetchHandler) => {
      listeners[type] = handler;
    },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  };
  const cacheStorage = new MockCacheStorage();
  const fetchMock = vi.fn<(req: Request) => Promise<Response>>();

  const factory = new Function(
    "self",
    "caches",
    "fetch",
    "URL",
    "Request",
    "Response",
    "Headers",
    "console",
    SW_SOURCE,
  );
  factory(self, cacheStorage, fetchMock, URL, Request, Response, Headers, console);

  return { listeners, cacheStorage, fetchMock };
}

// A fake Request carrying only the fields the fetch handler reads. (undici's
// Request forbids constructing mode: "navigate" and relative URLs, so we mock.)
function fakeRequest(
  path: string,
  { mode = "cors", headers = {} as Record<string, string> } = {},
) {
  return {
    url: `${ORIGIN}${path}`,
    method: "GET",
    mode,
    headers: new Headers(headers),
  };
}

const RSC_NAV_HEADERS = { rsc: "1", "next-router-state-tree": "%5B%22%22%5D" };
const RSC_PREFETCH_HEADERS = { rsc: "1", "next-router-prefetch": "1" };

async function dispatchFetch(handler: FetchHandler, request: unknown) {
  let responded: Promise<Response> | undefined;
  handler({
    request,
    respondWith: (promise: Promise<Response>) => {
      responded = promise;
    },
    waitUntil: () => {},
  });
  // Awaiting the respondWith promise lets any cache writes inside the strategy
  // settle. A bypassed request never calls respondWith → nothing to await.
  return responded ? await responded : undefined;
}

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
