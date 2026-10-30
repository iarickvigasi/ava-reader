# Dev environment & workflows

Catalog workspace: [catalog development and operations](catalog.md).
Deployment: [production deployment](deployment.md); [server security](server-security.md).
DB memory rollout: [tuning](catalog-import-tuning.md).

Dev workflows and pitfalls; product behaviour lives in specs/. Setup commands: README.md.
Temporary maintenance: [EPUB edge regrouping](../apps/api/src/scripts/chapter-edge-backfill/README.md).
[EPUB label backfill](../apps/api/src/scripts/chapter-label-backfill/README.md).

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

Web-specific pitfalls: [web development](web-development.md).
