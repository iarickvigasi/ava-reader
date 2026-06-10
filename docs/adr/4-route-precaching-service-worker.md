# 4. Route precaching via SW message + globbed asset manifest

Status: accepted

## Context
Offline-first (ADR [[3-offline-first-dexie-buckets]]) caches *data* in Dexie, but a Next App Router route also needs its HTML document, RSC payload, and JS/CSS chunks to load offline. Our hand-rolled service worker (apps/web/public/sw.js) caches these only *reactively* (network-first) on real online visits, so a route the user never opened — or a hard reload / direct URL of one they did — fails offline ("site can't be reached"). Goal: visiting any one app route makes every other route loadable offline, **including hard reload**, for all routes incl. reader shells.

Options weighed:
- **A — hidden-iframe pass:** load each route in a hidden iframe so the SW caches it reactively. Rejected: executing reader/book pages fires side effects (auto-save downloads, reading sessions, `/api` calls, Clerk mount).
- **B — extend our SW:** precache message + a build-time static-asset list. Chosen.
- **C — adopt Serwist** (Workbox successor, MIT): auto-generated precache manifest. Rejected: forces rewriting our working `/api` bypass, RSC keying, and Clerk-redirect guard to regain features we already have, plus a build-plugin dependency; its one real win (auto manifest) is a ~30-line script in B.

## Decision
Keep the hand-rolled SW; add two pieces:
1. A post-build script globs `.next/static/**/*.{js,css}` → `public/precache-assets.<version>.json` (flat URL list under `/_next/static`). The SW precaches it cache-first/immutable on activate, so **every route's chunks are present** offline. Globbing the output dir avoids coupling to any Next-internal manifest shape.
2. The prime island posts the SW a `PRECACHE_ROUTES` message with concrete URLs (static routes + slugs from cached library data). The SW fetches each route's **document** (plain GET) and **RSC payload** (`RSC:1` header) and stores them under the existing `__sw=doc` / `__sw=rsc` keys. Pages are fetched, never executed — no side effects.

## Consequences
- Any app route loads offline after one online visit, incl. hard reload, with no page side effects.
- Reuses the SW key scheme, version stamping, and the prime trigger / once-per-device machinery — no parallel mechanism. See [[14-route-precaching]].
- Cost: a new build step; SW grows a message handler + precache logic; per-slug docs/RSC are fetched live, so a book added on another device isn't precached until a later online prime.
- Reversible-ish: purely additive to the SW — removing it leaves reactive caching intact, and adopting Serwist later stays possible.
