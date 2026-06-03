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
    })(),
  );
});

function isRscRequest(request) {
  // Next.js soft navigations request the React Flight payload. They carry an
  // `RSC: 1` header (and Accept: text/x-component). Treat them like
  // navigations: network-first with a cache fallback.
  return (
    request.headers.get("RSC") === "1" ||
    (request.headers.get("Accept") || "").includes("text/x-component")
  );
}

// Build a stable cache key for a navigation/RSC request.
// - Strips Next's `_rsc=<hash>` cache-buster, which varies between the online
//   visit and the offline navigation and would otherwise cause a cache miss.
// - Tags the key with the content kind ("doc" vs "rsc") so a cached HTML
//   document and a cached Flight payload for the same route don't overwrite
//   or get served in place of one another (different content types).
// The result is a real URL string, which Cache Storage accepts as a key.
function navigationCacheKey(request, kind) {
  const url = new URL(request.url);
  url.searchParams.delete("_rsc");
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
