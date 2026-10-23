# Catalog development and operations

Independent NestJS workspace: apps/catalog. Its Prisma client generates into its own ignored
`generated/client` directory; it never imports the main API client or uses DATABASE_URL.
The same host can run both stacks, using separate PostgreSQL containers and persistent volumes.

Importer commands/checkpoints: [import operations](dev-catalog-import.md).

## Local commands

- Install: `pnpm install`; generate explicitly after `--ignore-scripts`:
  `pnpm --filter catalog db:generate` and `pnpm --filter api db:generate`.
- Database only: `docker compose up -d catalog-postgres` (host port 15433, loopback only).
- Host API: copy apps/catalog/.env.example to apps/catalog/.env; run from repository root:
  `pnpm --filter catalog db:migrate:deploy`, `pnpm --filter catalog db:seed`, `pnpm dev:catalog`.
- Full catalog container: `pnpm catalog:up`; optional seed: `pnpm catalog:seed`.
- Check: `curl http://localhost:4001/api/health`. Demo work UUID:
  `20000000-0000-4000-8000-000000000001`; author UUID:
  `10000000-0000-4000-8000-000000000001`. Read routes: spec 12.5.
- Unit checks: `pnpm --filter catalog test`; DB/HTTP checks against a disposable catalog DB:
  `pnpm --filter catalog test:integration`. Integration seeds fictional demo data and removes its
  temporary pagination fixtures; never run it against production.

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
