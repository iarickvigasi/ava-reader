import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { vi } from "vitest";

// Shared harness for exercising the real service worker
// (apps/web/public/sw.js): evaluates it inside a minimal mock of the
// ServiceWorkerGlobalScope so cache strategies are covered without a browser.

const SW_SOURCE = readFileSync(
  fileURLToPath(new URL("../../../public/sw.js", import.meta.url)),
  "utf8",
);

export const ORIGIN = "https://avareader.space";

export const RSC_NAV_HEADERS = {
  rsc: "1",
  "next-router-state-tree": "%5B%22%22%5D",
};
export const RSC_PREFETCH_HEADERS = { rsc: "1", "next-router-prefetch": "1" };

// A Cache backed by a Map keyed on the request URL string (navigationCacheKey
// hands the SW real URL strings as keys).
export class MockCache {
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

export class MockCacheStorage {
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

export type SwListener = (event: unknown) => void;

export function loadServiceWorker() {
  const listeners: Record<string, SwListener> = {};
  const self = {
    location: new URL(`${ORIGIN}/sw.js?v=test`),
    addEventListener: (type: string, handler: SwListener) => {
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
export function fakeRequest(
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

export async function dispatchFetch(handler: SwListener, request: unknown) {
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
