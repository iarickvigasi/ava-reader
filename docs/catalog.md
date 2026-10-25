# Catalog development and operations

Independent NestJS workspace: apps/catalog. Its Prisma client generates into its own ignored
`generated/client` directory; it never imports the main API client or uses DATABASE_URL.

Importer commands/checkpoints: [import operations](catalog-import.md).

## Local commands

- Install: `pnpm install`; generate explicitly after `--ignore-scripts`:
  `pnpm --filter catalog db:generate` and `pnpm --filter api db:generate`.
- Database only: `docker compose up -d catalog-postgres` (host port 15433, loopback only).
- Host API: copy apps/catalog/.env.example to apps/catalog/.env; run from repository root:
  `pnpm --filter catalog db:migrate:deploy`, `pnpm dev:catalog`.
- Full catalog container: `pnpm catalog:up`.
- Check: `curl http://localhost:4001/api/health`. Read routes: spec 12.5.
- Unit checks: `pnpm --filter catalog test`; DB/HTTP checks against a disposable catalog DB:
  `pnpm --filter catalog test:integration`. Integration seeds fictional demo data and removes its
  temporary pagination fixtures; never run it against production.

## Explore integration

Next dev defaults to `http://localhost:4001`; production defaults to same-origin `/catalog`.
NEXT_PUBLIC_CATALOG_API_BASE_URL is compiled into browser JavaScript; rebuild web after changes.
The client appends `/api`, so configure `/catalog`, not `/catalog/api`. Other relative paths,
credentials, and production HTTP/loopback origins are rejected; HTTPS origin overrides remain valid.
Local Docker web builds need `/catalog` with a gateway, or an HTTPS catalog origin override.

## Production gateway and deployment

- Dockerized production Caddy mounts the tracked root Caddyfile and routes /catalog/\* to
  catalog:4001 on the shared Compose network. Validate and reload Caddy after config changes.
- For a host gateway, reuse avareader.space DNS/TLS. Import `tools/deploy/catalog.Caddyfile` inside its existing
  Caddy site block, before the reader fallback; validate and reload the host gateway.
  With another gateway, add the equivalent path rule: `/catalog/api/*` → catalog `/api/*`.
  Strip only `/catalog`, preserve query strings, and route before the reader/main API handlers.
  The host snippet targets port 4001; adapt for CATALOG_HOST_PORT or a container/remote gateway.
- `compose.prod.yaml` pins the browser base to `/catalog`; requests stay on the reader origin.
  Keep catalog PostgreSQL private; expose port 4001 only to the gateway via the host firewall.
- Production catalog DB lives at /mnt/HC_Volume_107260972/ava-catalog/postgres;
  compose.prod.yaml replaces the development Docker volume. Mount the attached disk before deploy.
- Production main PostgreSQL has no host port; its password comes from server-only
  AVA_POSTGRES_PASSWORD. Do not replace production Compose with development defaults.
- Follow the build → database startup → migrations → application startup order in
  [production deployment](deployment.md); production startup does not run migrations.
- Verify `https://avareader.space/catalog/api/health`, `/catalog/api/works?limit=1`, and
  `/catalog/api/works/filters` return JSON. Deployment checks health and a bounded works request.
  Verify Explore search, book/author navigation, and same-origin catalog requests in DevTools.

## Configuration and host separation

- Host .env is workspace-local; Compose reads the root .env. CATALOG_DATABASE_URL selects only
  catalog PostgreSQL; CATALOG_PORT defaults to 4001 and CATALOG_WEB_ORIGIN is a comma-separated list.
- Compose defaults target local development; set CATALOG_POSTGRES_PASSWORD before creating a remote
  deployment. An existing volume retains its original password. Keep PostgreSQL private.
- CATALOG_HOST_PORT and CATALOG_POSTGRES_HOST_PORT select published ports. The root
  CATALOG_DATABASE_URL override must be reachable from inside the catalog container, not localhost.
- Catalog DB: 512 MiB, 0.5 CPU, max 30 connections. API: 512 MiB, 0.5 CPU; pool max 10,
  connection and SQL timeouts 5s. These are initial development limits, not capacity measurements.
- Migrations run before container startup; seeds never do. Rebuild/restart after schema changes.
- Later move the DB/API to other hosts by transferring the catalog volume via backup/restore or
  replication and changing configured endpoints; no cross-database foreign keys or shared files.
- Production readiness still requires TLS/gateway/rate limits, secrets, off-host backup scheduling,
  PITR and restore drills, monitoring, and measured sizing. Compose volumes alone are not backups.

Fictional catalog data exists only under `apps/catalog/test/fixtures` for integration tests.
production migrations run in the separate `catalog-migrate` service before startup.
