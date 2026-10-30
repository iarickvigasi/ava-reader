# Web development gotchas

- SW/offline testing only at exactly http://localhost:3000 (secure context) — on a LAN IP or other
  host navigator.serviceWorker is undefined and registration silently no-ops. DevTools-Offline
  exercises SW fallbacks but keeps navigator.onLine true; wifi-off flips onLine but loopback still
  reaches the server — neither fully simulates production offline.
- A dead API (Docker daemon down) reads as "only the covers are broken": home and library fall
  back to the Dexie last-good payload (fetchServerApiTolerant) and book-info's shell hydrates
  client-side, so all text renders, while every cover is an <img> at :4000 → BookCoverFallback.
  `curl localhost:4000/api/library/covers/<bookId>` before suspecting cover code.
- Turbopack fast refresh can desync: new utilities land in the compiled CSS while the element
  keeps old classes. Hard-refresh before debugging a className change that "didn't apply".
- A new route/layout fails `pnpm typecheck` until `pnpm build` regenerates .next/types (next dev
  only writes .next/dev/types, whose validator imports the stale .next/types/routes).
- /dev/reader-resume-fixture and /dev/bilingual-fixture are auth-free reader fixtures; the latter
  seeds only its own cached book. apps/web/e2e/bilingual.playwright.js checks paging/rotation.
  apps/web/app/dev/layout.tsx provides their ReaderUiProvider + shell box — keep it.
  Use ?phone=1 for viewport-based rotation, or ?incremental=1 for an initially empty fake cache.
  Next translation / Run arrivals release sentences; metrics count removals after column mount.
- Device-only bugs (iOS Safari): tools/iphone-inspector/ evaluates JS inside the real logged-in
  Safari tab over USB — recorders, pitfalls, and the full workflow are in its README.

Next's updated lint defaults flag synchronous initialization in the existing offline route loaders
and cancelled-read reset hook. Their file-scoped performance-rule exceptions preserve the ADR 4
browser hydration/reconnect contract during security upgrades; all other hook rules remain enabled.
