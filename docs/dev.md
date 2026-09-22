# Dev environment & workflows

How the dev setup behaves and the traps it hides — for developers and agents. Product behaviour
lives in specs/, architecture in architecture.md, setup commands in README.md. Keep ≤60 lines.

## Split dev workflow (commands: README → Split Dev Workflow)

- `corepack pnpm dev:split`: postgres + API in Docker (compose.yaml + compose.dev.yaml), web via
  the local Next dev server. Only ./apps/api is bind-mounted into the API container; node_modules
  and the generated Prisma client live in the image's pnpm store.
- API container entrypoint: apps/api/scripts/dev-server.sh — prisma migrate deploy → prisma
  generate → `nest start --watch --no-shell`.
- `--no-shell` is load-bearing: the CLI's watch-respawn kill (treeKillSync) needs `ps` — absent
  from the image — to find children, so with the shell default (v11) the app is a /bin/sh
  grandchild that survives the kill as an orphan holding :4000; every respawn then dies with
  EADDRINUSE and stale code serves until a container restart. Direct child ⇒ killed by pid,
  and the respawn (on its exit event) cannot race the port.
- Replacing an API source file host-side (observed with `mv` onto it; anything inode-swapping)
  can kill tsc watch's watcher for that file over the bind mount — later edits silently stop
  triggering rebuilds until the container restarts. In-place writes (editor saves, `>>`) are fine.

## Prisma schema changes (dev API)

- dev-server.sh polls prisma/schema.prisma (cksum, 2s); on change it regenerates the client
  in-container and restarts Nest's whole process group. Expect `[dev-server] … changed` then
  `Found 0 errors` in `pnpm dev:split:logs` within ~30s — no manual container restart.
- Why restart, not hot-patch: tsc --watch doesn't reliably re-read node_modules .d.ts, and killing
  only the Nest CLI orphans the app on port 4000 (hence setsid + node group-kill in the script).
- Invalid schema → `prisma generate` fails → the container exit-loops with the Prisma error in the
  logs; fixing the schema self-heals. A container stuck restarting usually means this.
- The watcher never applies migrations — `migrate deploy` runs at container boot only. Create and
  apply migrations with the usual `prisma migrate dev` (`pnpm db:migrate` in apps/api); the local
  DB is disposable, so accepting a drift-triggered reset is fine.

## Auth against the dockerized API

- The API verifies Clerk tokens with CLERK_JWT_KEY from the **root .env** (apps/api/.env only
  applies outside Docker). It must be the dev Clerk project's public key: a wrong-project key 401s
  every request — symptom: signed in but home shows the offline modal and the fallback name
  "Reader". Not a cookie/SW bug.
- Compose env changes need `docker compose … up -d api`; a plain `docker restart` doesn't re-read
  .env.

## Web dev gotchas

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
