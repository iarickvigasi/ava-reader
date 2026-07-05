/* Ava Reader minimal offline service worker.
 *
 * Goal: make the app's HTML shell + JS/CSS chunks load offline so cold start,
 * hard refresh, and navigation to already-visited routes work without a
 * connection. The actual data layer (library, books, highlights, …) is owned
 * by Dexie + the sync runner — this worker deliberately does NOT cache or
 * intercept `/api/*`.
 *
 * Strategies:
 * - /_next/static/*  → cache-first (hashed, immutable filenames).
 * - navigations + RSC payloads → network-first, fall back to cache when
 *   offline. Freshness wins online (no stale-while-revalidate flash); the
 *   cache is only a safety net for offline. Redirects (Clerk handshake /
 *   sign-in) pass through untouched — see isRedirectResponse.
 * - other same-origin GET (fonts, /public assets) → cache-first.
 * - Next link prefetches (next-router-prefetch) → bypass entirely; their
 *   partial "loading" stubs must never poison the navigation cache.
 * - /api/*, cross-origin, non-GET → bypass entirely (network passthrough).
 *
 * Cache versioning: the registrar appends ?v=<build-version> to the worker
 * URL. We read that here and name the cache after it; on activate we delete
 * every cache that doesn't match, so a new build evicts the old assets.
 */

const SW_VERSION =
  new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `ava-reader-sw-${SW_VERSION}`;

self.addEventListener("install", (event) => {
  // Activate this worker as soon as it's installed rather than waiting for
  // all tabs to close. Combined with clients.claim() below, an updated worker
  // takes over on the next navigation.
  self.skipWaiting();
  void event;
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("ava-reader-sw-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
      // Precache every build asset (hashed JS/CSS) so any route's chunks are
      // present offline even if the user never visited that route online.
      await precacheBuildAssets();
    })(),
  );
});

// Reads the build-time manifest (regenerated each `next build`) and caches all
// listed `/_next/static` assets cache-first. A SW's own fetch() bypasses the
// fetch handler, so this always hits the network for the fresh manifest. Best
// effort: a failure (e.g. offline during activate) leaves assets to be cached
// reactively on first use.
async function precacheBuildAssets() {
  try {
    const response = await fetch("/precache-assets.json", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const assets = await response.json();
    if (!Array.isArray(assets)) {
      return;
    }
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      assets.map(async (url) => {
        if (typeof url !== "string" || (await cache.match(url))) {
          return;
        }
        try {
          const assetResponse = await fetch(url);
          if (assetResponse && assetResponse.ok) {
            await cache.put(url, assetResponse);
          }
        } catch {
          // Skip a single asset that fails; the rest still cache.
        }
      }),
    );
  } catch {
    // No manifest / offline — reactive caching covers it later.
  }
}

function isRscRequest(request) {
  // Next.js soft navigations request the React Flight payload. They carry an
  // `RSC: 1` header (and Accept: text/x-component). Treat them like
  // navigations: network-first with a cache fallback.
  return (
    request.headers.get("RSC") === "1" ||
    (request.headers.get("Accept") || "").includes("text/x-component")
  );
}

// Next marks link prefetches with one of these headers; a real navigation
// carries `next-router-state-tree` instead and never these. A dynamic route
// with a `loading.tsx` (e.g. /app/library) prefetches to a partial "loading"
// stub, not the full page — so prefetch responses must never be cached or
// served under the shared navigation key (see route-precaching spec).
function isPrefetchRequest(request) {
  return (
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("next-router-segment-prefetch") !== null
  );
}

// Build a stable cache key for a navigation/RSC request, keyed on pathname only.
// - Drops ALL query params: Next's `_rsc=<hash>` cache-buster, plus client-only
//   hydration hints the app appends when linking to a book (`?title=…&author=…&
//   fromCollection=…`). Those hints don't change the cached shell — the page
//   re-derives them — but if kept they'd make a real click miss the precached
//   bare route and fail offline ("site can't be reached").
// - Tags the key with the content kind ("doc" vs "rsc") so a cached HTML
//   document and a cached Flight payload for the same route don't overwrite
//   or get served in place of one another (different content types).
// The result is a real URL string, which Cache Storage accepts as a key.
function navigationCacheKey(request, kind) {
  const url = new URL(request.url);
  url.search = "";
  url.searchParams.set("__sw", kind);
  return url.toString();
}

// Per-entity routes are generic shells (ADR 4): every slug returns the same
// document, so each family keeps one extra cache entry under a `__shell__`
// key. Offline, a never-visited slug falls back to it; the shell hydrates the
// right book client-side from location.pathname + Dexie. Docs only — serving
// a mismatched RSC payload could make Next rewrite the URL, so RSC stays
// strictly per-URL and a failed RSC fetch hard-navigates into the doc path.
const SHELL_ROUTE_PREFIXES = [
  "/app/read/",
  "/app/library/books/",
  "/app/library/collections/",
];

function shellDocKey(request) {
  const url = new URL(request.url);
  for (const prefix of SHELL_ROUTE_PREFIXES) {
    if (url.pathname.startsWith(prefix) && url.pathname.length > prefix.length) {
      url.pathname = `${prefix}__shell__`;
      url.search = "";
      url.searchParams.set("__sw", "doc");
      return url.toString();
    }
  }
  return null;
}

// Store a successful document response under its exact per-URL key and, for
// shell families, refresh the family `__shell__` entry too.
function putDocResponse(cache, request, response) {
  cache.put(navigationCacheKey(request, "doc"), response.clone());
  const shellKey = shellDocKey(request);
  if (shellKey && shellKey !== navigationCacheKey(request, "doc")) {
    cache.put(shellKey, response.clone());
  }
}

async function matchDocFallback(request, cache) {
  const exact = await cache.match(navigationCacheKey(request, "doc"));
  if (exact) {
    return exact;
  }
  const shellKey = shellDocKey(request);
  if (shellKey) {
    const shell = await cache.match(shellKey);
    if (shell) {
      return shell;
    }
  }
  return null;
}

// A redirect must reach the browser untouched. Navigations carry redirect
// mode "manual", so a Clerk handshake/sign-in 307 surfaces here as an
// `opaqueredirect` (status 0, ok false) — substituting the cached shell for
// it swallows the auth flow: the session cookie never refreshes and every
// SSR render stays tokenless (the "offline fallback while online" bug).
function isRedirectResponse(response) {
  return (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  );
}

async function networkFirstDoc(request, cache) {
  try {
    const response = await fetch(request);
    if (isRedirectResponse(response)) {
      return response;
    }
    if (response && response.ok) {
      // A followed redirect (response.redirected) means this body belongs to
      // another URL (e.g. the sign-in page) — serve it, never cache it.
      if (!response.redirected) {
        putDocResponse(cache, request, response);
      }
      return response;
    }
    // Server reachable but erroring (4xx/5xx): prefer the last good cached
    // document (exact, then family shell) over an error page.
    const cached = await matchDocFallback(request, cache);
    return cached ?? response;
  } catch (error) {
    const cached = await matchDocFallback(request, cache);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function networkFirst(request, cache, kind) {
  const key = navigationCacheKey(request, kind);
  try {
    const response = await fetch(request);
    if (isRedirectResponse(response)) {
      return response;
    }
    // Only cache successful, non-redirected responses — a followed redirect's
    // body belongs to another URL and must never become this route's entry.
    if (response && response.ok) {
      if (!response.redirected) {
        cache.put(key, response.clone());
      }
      return response;
    }
    // Server reachable but erroring (4xx/5xx — e.g. wifi-off against a local
    // server whose auth/data deps are unreachable): prefer the last good
    // cached copy over an error page; fall through to the response otherwise.
    const cached = await cache.match(key);
    return cached ?? response;
  } catch (error) {
    const cached = await cache.match(key);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever touch same-origin GETs.
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept the data/auth layer — Dexie + Clerk own these and caching
  // them would serve stale or unauthorized data.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Let Next's prefetches pass straight through to the network — never cache or
  // serve them. A dynamic route's prefetch is a partial "loading" stub; caching
  // it under the shared navigation key overwrites the full payload and, served
  // offline, hangs the navigation (a valid 200 that Next neither completes nor
  // hard-falls-back from). The full RSC from the precache / a real navigation
  // stays the offline payload. See route-precaching spec.
  if (isPrefetchRequest(request)) {
    return;
  }

  const isNavigation = request.mode === "navigate";
  const isStaticChunk = url.pathname.startsWith("/_next/static/");

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      if (isStaticChunk) {
        return cacheFirst(request, cache);
      }
      if (isRscRequest(request)) {
        return networkFirst(request, cache, "rsc");
      }
      if (isNavigation) {
        return networkFirstDoc(request, cache);
      }
      // Fonts, icons, other /public assets.
      return cacheFirst(request, cache);
    })(),
  );
});

// How many route shells we fetch at once during a precache pass — enough to
// hide round-trips, low enough not to swamp the origin on a large library.
const PRECACHE_CONCURRENCY = 4;

// The client (AppShell island) hands us the fixed route list (static routes +
// per-family __shell__ sentinels). For each route we fetch and cache the HTML
// document and the RSC/Flight payload under the same keys real navigations
// use, so an offline hard reload or direct-URL entry is served from cache.
// Pages are fetched, never executed — no reader auto-save or reading-session
// side effects.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE_ROUTES" || !Array.isArray(data.routes)) {
    return;
  }
  // The client transfers a MessagePort to hear the completion ack (which routes
  // are now cached), so its "Ready for offline work" cue only fires once the
  // shells are genuinely present. Older callers without a port still work.
  const reply = event.ports && event.ports[0];
  event.waitUntil(
    precacheRoutes(data.routes).then((cached) => {
      if (reply) {
        reply.postMessage({ cached });
      }
    }),
  );
});

// Precaches every route's shell, then reports back which routes now have a
// cached document — the client uses that to know offline browsing is ready.
async function precacheRoutes(routes) {
  const cache = await caches.open(CACHE_NAME);
  const valid = routes.filter((route) => typeof route === "string");
  const queue = valid.slice();
  const worker = async () => {
    let route;
    while ((route = queue.shift()) !== undefined) {
      await cacheRouteShell(cache, route);
    }
  };
  await Promise.all(
    Array.from({ length: PRECACHE_CONCURRENCY }, () => worker()),
  );
  const cached = [];
  for (const route of valid) {
    if (await cache.match(navigationCacheKey(new Request(route), "doc"))) {
      cached.push(route);
    }
  }
  return cached;
}

async function cacheRouteShell(cache, route) {
  // redirect: "manual" — a stale session answers with a Clerk handshake /
  // sign-in redirect; following it would cache the *sign-in page* under this
  // route's key. Manual mode surfaces it as an opaqueredirect (not ok) that
  // storeRouteResponse skips.
  await Promise.all([
    storeRouteResponse(cache, new Request(route, { redirect: "manual" }), "doc"),
    storeRouteResponse(
      cache,
      new Request(route, { headers: { RSC: "1" }, redirect: "manual" }),
      "rsc",
    ),
  ]);
}

async function storeRouteResponse(cache, request, kind) {
  const key = navigationCacheKey(request, kind);
  if (await cache.match(key)) {
    return; // already cached (e.g. visited online) — don't refetch.
  }
  try {
    const response = await fetch(request);
    // Only cache a real 200 — a Clerk handshake 3xx is not `ok`, so auth
    // redirects never poison the cache.
    if (response && response.ok) {
      if (kind === "doc") {
        putDocResponse(cache, request, response);
      } else {
        await cache.put(key, response);
      }
    }
  } catch {
    // Offline or a transient failure — skip; the next pass retries.
  }
}
