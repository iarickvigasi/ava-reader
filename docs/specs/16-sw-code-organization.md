# Service worker code organization

> Status: active · Updated: 2026-07-05 · ADRs: [[4-route-precaching-service-worker]] · Related:
> [[14-route-precaching]], [[6-offline-reading]], [[11-cache-priming]] ·
> Code: apps/web/public/sw.js, apps/web/features/offline/sw/

## Summary
How apps/web/public/sw.js is structured so it stays readable. Pure code organization — the caching
*behavior* contract lives in [[14-route-precaching]] (and 6/11); this spec never restates it.

## Scope
- In: the file's delivery model, section order, comment policy, and the constraints a refactor of it
  must hold.
- Non-goals: any strategy/protocol change; splitting delivery into multiple files (decided against:
  no esbuild bundle step, no importScripts, no module SW — revisit only if the file outgrows ~400
  lines again, with build-time bundling as the documented next step).

## Behaviour
1. Delivery stays a single classic script at public/sw.js, fetched as /sw.js?v=<build> — no build,
   registration, or harness changes.
2. The file reads top-down in dependency order, banner-separated, one concern per section:
   header (5–8 lines: purpose + spec pointers) → version & cache name → lifecycle (install,
   activate, precacheBuildAssets) → request classification (isRscRequest, isPrefetchRequest,
   isRedirectResponse) → cache keys (navigationCacheKey, SHELL_ROUTE_PREFIXES, shellDocKey) →
   strategies (cacheFirst, networkFirst, networkFirstDoc + putDocResponse, matchDocFallback) →
   fetch router (bypass guards + dispatch only, no inline strategy logic) → route precache
   (message listener, PRECACHE_CONCURRENCY, precacheRoutes, cacheRouteShell, storeRouteResponse).
3. networkFirstDoc stays a separate explicit function — decided not to merge it into a
   parameterized networkFirst.
4. Comment policy: rationale lives in specs, not the file. A regression already documented in
   [[14-route-precaching]] (redirect pass-through, prefetch-stub poisoning, shell-key fallback,
   precache redirect:"manual") gets a one-liner naming the failure + spec pointer, e.g.
   `// Redirects pass through — substituting cache swallows the Clerk handshake (spec 14 §6).`
   Rationale found in a comment but missing from the spec is added to the spec before trimming.
   Purely local mechanics keep one-liners.

## Data & sync
None — no entities, endpoints, or buckets. Observable behavior (cache keys, strategy order, message
protocol, function names) is unchanged by organization work.

## Edge cases
The Vitest harness (features/offline/sw/sw-test-harness.ts) evaluates the real sw.js source with
only these globals: self, caches, fetch, URL, Request, Response, Headers, console — the file must
reference nothing else. Offline flows are manually testable only at http://localhost:3000 against a
production build.

## Acceptance criteria
- [x] sw.js follows the section order above. Length is ~370 lines: the file is ~263 lines of
  irreducible logic (the ≤100-line convention can't apply to a single-file SW, and networkFirstDoc
  is kept separate by choice), so the win is structural — sections + spec-pointer comments — not a
  large line-count drop. Splitting into bundled modules (deferred, see Non-goals) is the lever for
  a smaller file.
- [x] All existing tests (sw-fetch-handler.test.ts, precache-routes.test.ts) pass unmodified.
- [x] No comment block restates rationale already in [[14-route-precaching]]; every trimmed trap
  keeps a failure-naming one-liner with a spec pointer.
- [x] pnpm --filter web test, typecheck, lint all pass.
