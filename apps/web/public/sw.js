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
 *   cache is only a safety net for offline.
 * - other same-origin GET (fonts, /public assets) → cache-first.
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

async function networkFirst(request, cache, kind) {
  const key = navigationCacheKey(request, kind);
  try {
    const response = await fetch(request);
    // Only cache successful responses (a Clerk handshake 3xx is not `ok`, so
    // redirects never poison the cache).
    if (response && response.ok) {
      cache.put(key, response.clone());
    }
    return response;
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
        return networkFirst(request, cache, "doc");
      }
      // Fonts, icons, other /public assets.
      return cacheFirst(request, cache);
    })(),
  );
});

// How many route shells we fetch at once during a precache pass — enough to
// hide round-trips, low enough not to swamp the origin on a large library.
const PRECACHE_CONCURRENCY = 4;

// The client (AppShell island) hands us the route list once the library view is
// known. For each route we fetch and cache the HTML document and the RSC/Flight
// payload under the same keys real navigations use, so an offline hard reload or
// direct-URL entry is served from cache. Pages are fetched, never executed — no
// reader auto-save or reading-session side effects.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE_ROUTES" || !Array.isArray(data.routes)) {
    return;
  }
  event.waitUntil(precacheRoutes(data.routes));
});

async function precacheRoutes(routes) {
  const cache = await caches.open(CACHE_NAME);
  const queue = routes.filter((route) => typeof route === "string");
  const worker = async () => {
    let route;
    while ((route = queue.shift()) !== undefined) {
      await cacheRouteShell(cache, route);
    }
  };
  await Promise.all(
    Array.from({ length: PRECACHE_CONCURRENCY }, () => worker()),
  );
}

async function cacheRouteShell(cache, route) {
  await Promise.all([
    storeRouteResponse(cache, new Request(route), "doc"),
    storeRouteResponse(
      cache,
      new Request(route, { headers: { RSC: "1" } }),
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
      await cache.put(key, response);
    }
  } catch {
    // Offline or a transient failure — skip; the next pass retries.
  }
}
