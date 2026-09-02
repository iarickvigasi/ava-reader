/* Ava Reader offline service worker.
 *
 * Makes the app's HTML shell + JS/CSS chunks load offline. The data layer is
 * owned by Dexie buckets + the sync runner — /api/* is never intercepted.
 * Behavior contract (strategies, cache keys, precache protocol, and the
 * regression traps behind them): docs/specs/6-offline/6.5-route-precaching.md, with
 * specs 6.1 (offline reading), 6.4 (cache priming) and ADR 4. File layout:
 * docs/specs/6-offline/6.6-sw-code-organization.md.
 */

/* ----------------------------------------------------------------------------
 * Version & cache name
 * -------------------------------------------------------------------------- */

// The registrar appends ?v=<build-version> to the worker URL; activate deletes
// every cache that doesn't match, so a new build evicts the old assets.
const SW_VERSION =
  new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `ava-reader-sw-${SW_VERSION}`;

/* ----------------------------------------------------------------------------
 * Lifecycle
 * -------------------------------------------------------------------------- */

self.addEventListener("install", (event) => {
  // With clients.claim() below, an updated worker takes over on the next
  // navigation instead of waiting for every tab to close.
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
      await precacheBuildAssets();
    })(),
  );
});

// Precache every build asset from the manifest so a route's chunks are present
// offline (spec 6.5 §2). Best effort — on failure they cache reactively later.
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
          // Skip a failing asset; the rest still cache.
        }
      }),
    );
  } catch {
    // No manifest / offline — reactive caching covers it later.
  }
}

/* ----------------------------------------------------------------------------
 * Request classification
 * -------------------------------------------------------------------------- */

// Next soft navigations request the React Flight payload. These are never
// cached or served: the server varies them on `next-router-state-tree`, so a
// payload stored per pathname answers a different question than the next
// request asks. A mismatched 200 strands the router — URL changed, previous
// page still painted, no error and no fallback. Failing instead is what
// triggers Next's hard navigation onto the cached document (spec 6.5 §5).
function isRscRequest(request) {
  return (
    request.headers.get("RSC") === "1" ||
    (request.headers.get("Accept") || "").includes("text/x-component")
  );
}

// Link prefetches are never cached or served — a dynamic route's prefetch is a
// partial "loading" stub that would poison the navigation key (spec 6.5 §5).
// Real navigations carry next-router-state-tree instead, never these.
function isPrefetchRequest(request) {
  return (
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("next-router-segment-prefetch") !== null
  );
}

// Redirects reach the browser untouched — substituting the cached shell
// swallows the Clerk handshake (spec 6.5 §6). Navigations use redirect mode
// "manual", so a 307 surfaces as an opaqueredirect (status 0, not ok).
function isRedirectResponse(response) {
  return (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  );
}

/* ----------------------------------------------------------------------------
 * Cache keys
 * -------------------------------------------------------------------------- */

// Stable per-route key: pathname only (ALL query params dropped). Documents
// are the only thing keyed this way — RSC payloads are never cached.
function navigationCacheKey(request) {
  const url = new URL(request.url);
  url.search = "";
  url.searchParams.set("__sw", "doc");
  return url.toString();
}

// Per-entity routes are generic shells (ADR 4): each family keeps one extra
// doc entry under a __shell__ key so a never-visited slug still gets a shell
// offline (spec 6.5 §7).
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

/* ----------------------------------------------------------------------------
 * Strategies
 * -------------------------------------------------------------------------- */

// For hashed build chunks and /public assets.
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

// Store a successful document under its exact per-URL key and, for shell
// families, refresh the family __shell__ entry too.
function putDocResponse(cache, request, response) {
  cache.put(navigationCacheKey(request), response.clone());
  const shellKey = shellDocKey(request);
  if (shellKey && shellKey !== navigationCacheKey(request)) {
    cache.put(shellKey, response.clone());
  }
}

// Offline doc lookup: exact per-URL match first, then the family shell.
async function matchDocFallback(request, cache) {
  const exact = await cache.match(navigationCacheKey(request));
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

// Network-first for documents: freshness wins online, the cache is the
// offline safety net. Reads fall back through matchDocFallback and writes go
// through putDocResponse.
async function networkFirstDoc(request, cache) {
  try {
    const response = await fetch(request);
    if (isRedirectResponse(response)) {
      return response;
    }
    if (response && response.ok) {
      if (!response.redirected) {
        putDocResponse(cache, request, response);
      }
      return response;
    }
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

/* ----------------------------------------------------------------------------
 * Fetch router — bypass guards + dispatch only, no strategy logic inline
 * -------------------------------------------------------------------------- */

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
  // The data/auth layer is owned by Dexie + Clerk — never intercepted.
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  // Prefetch stubs must never touch the cache, and RSC payloads must never be
  // cached or served at all (spec 6.5 §5).
  if (isPrefetchRequest(request) || isRscRequest(request)) {
    return;
  }

  const isNavigation = request.mode === "navigate";
  const isStaticChunk = url.pathname.startsWith("/_next/static/");

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      if (isStaticChunk) {
        return cacheFirst(request, cache); // hashed, immutable filenames
      }
      if (isNavigation) {
        return networkFirstDoc(request, cache);
      }
      return cacheFirst(request, cache); // fonts, icons, other /public assets
    })(),
  );
});

/* ----------------------------------------------------------------------------
 * Route precache — client posts PRECACHE_ROUTES; see spec 6.5 §3–4
 * -------------------------------------------------------------------------- */

// Enough parallel fetches to hide round-trips without swamping the origin.
const PRECACHE_CONCURRENCY = 4;

// The AppShell island posts the fixed route list (static routes + __shell__
// sentinels). Pages are fetched, never executed — no reader side effects. The
// transferred MessagePort (optional for older callers) carries the completion
// ack so the client's readiness cue fires only once shells are truly cached.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE_ROUTES" || !Array.isArray(data.routes)) {
    return;
  }
  const reply = event.ports && event.ports[0];
  event.waitUntil(
    precacheRoutes(data.routes).then((cached) => {
      if (reply) {
        reply.postMessage({ cached });
      }
    }),
  );
});

// Cache every route's shell, then report which routes now have a cached doc.
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
    if (await cache.match(navigationCacheKey(new Request(route)))) {
      cached.push(route);
    }
  }
  return cached;
}

// redirect: "manual" so a stale session's Clerk redirect is never followed
// into a 200 that poisons the route key (spec 6.5 §4).
async function cacheRouteShell(cache, route) {
  await storeRouteResponse(cache, new Request(route, { redirect: "manual" }));
}

async function storeRouteResponse(cache, request) {
  const key = navigationCacheKey(request);
  if (await cache.match(key)) {
    return; // already cached (e.g. visited online) — don't refetch.
  }
  try {
    const response = await fetch(request);
    // Only a real 200 is cached — a Clerk handshake 3xx is not ok (spec 6.5 §4).
    if (response && response.ok) {
      putDocResponse(cache, request, response);
    }
  } catch {
    // Offline or transient failure — skip; the next pass retries.
  }
}
