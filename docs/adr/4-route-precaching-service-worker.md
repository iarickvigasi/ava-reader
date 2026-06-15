# 4. Offline route shells: SW precache + generic client-hydrated pages

Status: accepted

## Context
Offline-first (ADR [[3-offline-first-dexie-buckets]]) caches *data* in Dexie, but a Next App Router route also needs its HTML document, RSC payload, and JS/CSS chunks to load offline. Our hand-rolled service worker (apps/web/public/sw.js) cached these only *reactively* (network-first) on real online visits, so a route the user never opened — or a hard reload of one they did — failed offline ("site can't be reached"). Goal: visiting any one app route online makes every app route loadable offline, including hard reload and reader shells.

Options weighed for filling the cache:
- **Hidden-iframe pass** — load each route in an iframe so the SW caches it reactively. Rejected: executing reader/book pages fires side effects (auto-save downloads, reading sessions, `/api` calls, Clerk mount).
- **Adopt Serwist** (Workbox successor, MIT) for its auto-generated precache manifest. Rejected: forces rewriting our working `/api` bypass, RSC keying, and Clerk-redirect guard to regain features we already have, plus a build-plugin dependency; its one real win (the manifest) is a ~30-line script.
- **Extend our SW** with a precache message + build-time asset list. Chosen.

Within that, the first iteration precached a **doc + RSC per book**, because each per-entity page (reader, book-info, collection) was a `force-dynamic` server component baking its payload into the page. Field data showed this is structurally fragile: 2N background fetches race the user going offline, RSC caches less reliably than doc (cached doc + missing RSC → Next retry → hard-nav → "wait, click again"; neither → unreachable), and books added later are never covered. Per-book page precache rejected — the payload it bakes in is redundant with Dexie, which already holds the data.

## Decision
1. **Assets:** a post-build script globs `.next/static/**/*.{js,css}` → `public/precache-assets.json`; the SW precaches the list on activate, so every route's chunks exist offline. Globbing the output dir avoids coupling to Next-internal manifest shapes.
2. **Generic shells:** the per-entity routes (`/app/read/[slug]`, `/app/library/books/[slug]`, `/app/library/collections/[slug]`) stop fetching data server-side. A client loader derives the slug from `window.location.pathname` — not `useParams()`, whose baked value lies when a fallback shell is served under another slug's URL — and hydrates from the Dexie buckets (network fallback while online, existing skeletons meanwhile). Online auth gating is untouched (`proxy.ts` Clerk middleware covers `/app(.*)`).
3. **Route precache:** an AppShell island posts the SW a `PRECACHE_ROUTES` message with the static routes plus one `__shell__` sentinel per per-entity family — ~7 fetches total, no library enumeration. The SW fetches each route's doc (and RSC) and stores them under the existing `__sw=doc`/`__sw=rsc` keys, query params stripped. Pages are fetched, never executed.
4. **Offline serving:** docs match exact per-URL first, then fall back to the per-family `__shell__` entry (every successful shell-route doc fetch also refreshes it). RSC stays strictly per-URL with no cross-slug fallback — a mismatched RSC payload risks Next rewriting the canonical URL; a failed RSC fetch triggers Next's own hard-navigation, which lands on the doc path and gets the shell.

## Consequences
- "Readable offline" now equals "content is in Dexie" — the condition the user actually controls — instead of "did a 2N-fetch background precache finish before the connection dropped".
- Cost: per-entity routes paint a brief skeleton online instead of SSR; unknown slugs render a client "not available" state, not an HTTP 404. The exception to "server components fetch the initial payload" is recorded in conventions.md.
- A book added on another device still needs its *content* primed ([[11-cache-priming]]); the route shell itself is already covered.
- Reversible-ish: the SW additions are additive (removing them leaves reactive caching intact); shells could revert to SSR pages independently. See [[14-route-precaching]].
