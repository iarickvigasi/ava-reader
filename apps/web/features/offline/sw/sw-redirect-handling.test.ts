import { beforeEach, describe, expect, it } from "vitest";

// Bug under test (prod, mobile): a Clerk handshake/sign-in 307 on a
// navigation surfaces in the SW as an `opaqueredirect` (`ok === false`), and
// the network-first strategies treated it as "server erroring → serve the
// cached shell". That swallowed the auth flow: the session cookie never
// refreshed, every SSR render was tokenless, and the user was stranded on
// the offline-route fallback while online. Redirects must reach the browser
// untouched, and no redirected response may ever be cached as a route's
// canonical entry. See docs/specs/4-offline/4.5-route-precaching.md §6, 7-auth.md.
//
// Only documents are covered here. RSC requests are no longer intercepted at
// all (spec 4.5 §5), so their redirects reach the browser by definition —
// sw-fetch-handler.test.ts owns that contract.

import {
  dispatchFetch,
  fakeRequest,
  loadServiceWorker,
  MockCache,
  ORIGIN,
} from "./sw-test-harness";

const APP_DOC_KEY = `${ORIGIN}/app?__sw=doc`;

// Navigations have redirect mode "manual": fetch() resolves an opaqueredirect
// (status 0, ok false). undici can't construct one, so fake the read surface.
function opaqueRedirect() {
  return {
    ok: false,
    status: 0,
    type: "opaqueredirect",
    redirected: false,
  } as unknown as Response;
}

// A subresource fetch (redirect: "follow") that followed a redirect chain to
// a 200 — e.g. an RSC fetch bounced through Clerk to the sign-in page.
function followedRedirect(body: string) {
  const inner = new Response(body, { status: 200 });
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === "redirected") return true;
      if (prop === "clone") return () => followedRedirect(body);
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Response;
}

describe("service worker — redirects pass through and never poison the cache", () => {
  let sw: ReturnType<typeof loadServiceWorker>;
  let cache: MockCache;

  beforeEach(async () => {
    sw = loadServiceWorker();
    cache = await sw.cacheStorage.open("ava-reader-sw-test");
  });

  it("returns an opaqueredirect navigation response as-is even when a shell is cached", async () => {
    await cache.put(APP_DOC_KEY, new Response("STALE_SHELL", { status: 200 }));
    const redirect = opaqueRedirect();
    sw.fetchMock.mockResolvedValue(redirect);

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app", { mode: "navigate" }),
    );

    expect(response).toBe(redirect);
  });

  it("still serves the cached shell on a plain 4xx/5xx (resilience unchanged)", async () => {
    await cache.put(APP_DOC_KEY, new Response("GOOD_SHELL", { status: 200 }));
    sw.fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    const response = await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app", { mode: "navigate" }),
    );

    expect(await response?.text()).toBe("GOOD_SHELL");
  });

  it("never caches a followed-redirect 200 under the route's doc key", async () => {
    sw.fetchMock.mockResolvedValue(followedRedirect("SIGN_IN_PAGE"));

    await dispatchFetch(
      sw.listeners.fetch!,
      fakeRequest("/app", { mode: "navigate" }),
    );

    expect(await cache.match(APP_DOC_KEY)).toBeUndefined();
  });

  it("precaches with redirect:'manual' and skips a route answering with a redirect", async () => {
    sw.fetchMock.mockResolvedValue(opaqueRedirect());

    let settled: Promise<unknown> | undefined;
    sw.listeners.message!({
      data: { type: "PRECACHE_ROUTES", routes: [`${ORIGIN}/app`] },
      ports: [],
      waitUntil: (promise: Promise<unknown>) => {
        settled = promise;
      },
    });
    await settled;

    for (const request of sw.fetchMock.mock.calls.map(([req]) => req)) {
      expect(request.redirect).toBe("manual");
    }
    expect(await cache.match(APP_DOC_KEY)).toBeUndefined();
  });
});
