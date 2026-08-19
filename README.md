# Ava Reader

Monorepo scaffold for a web-first AI book reader.

## Stack

- `apps/web`: Next.js 16 App Router
- `apps/api`: NestJS 11 + Prisma + PostgreSQL
- `apps/mobile`: placeholder for the future mobile app
- `pnpm` workspaces + `turbo`: shared repo tooling

## Docker Quick Start

1. Create a root Compose env file:

   ```bash
   cp .env.example .env
   ```

   Optional: add your Clerk keys to `.env` so `/sign-in`, `/sign-up`, and `/app` run the real auth flow. Without Clerk keys, the public landing page still works and the auth routes show a configuration prompt.

2. Build and start the full stack:

   ```bash
   pnpm docker:up
   ```

3. Verify container-to-container connectivity:

   ```bash
   pnpm docker:verify
   ```

4. Open the apps:

   - Web landing: `http://localhost:3000`
   - Sign in: `http://localhost:3000/sign-in`
   - Protected shell: `http://localhost:3000/app`
   - Internal admin catalog: `http://localhost:3000/app/admin/catalog`
   - API health: `http://localhost:4000/api/health`
   - API current user: `GET http://localhost:4000/api/me` with a Clerk bearer token
   - API home payload: `GET http://localhost:4000/api/home` with a Clerk bearer token
   - PostgreSQL: `postgresql://postgres:postgres@localhost:15432/ava_reader?schema=public`

5. Stop the stack when you are done:

   ```bash
   pnpm docker:down
   ```

## Local Non-Docker Workflow

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create local env files:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Start PostgreSQL:

   ```bash
   pnpm db:up
   ```

4. Generate the Prisma client:

   ```bash
   pnpm db:generate
   ```

5. Push the local schema to Postgres:

   ```bash
   pnpm db:push
   ```

6. Run the apps:

   ```bash
   pnpm dev
   ```

## Split Dev Workflow

Use this when you want frontend changes to appear immediately while still
keeping the backend database and API inside Docker.

1. Start PostgreSQL and a hot-reloading Nest API in Docker:

   ```bash
   corepack pnpm dev:split
   ```

2. Start the Next.js frontend locally:

   ```bash
   corepack pnpm --filter web dev
   ```

3. Open the apps:

   - Web: `http://localhost:3000`
   - API health: `http://localhost:4000/api/health`

4. Follow logs when needed:

   ```bash
   corepack pnpm dev:split:logs
   ```

5. Stop the split setup:

   ```bash
   corepack pnpm dev:split:down
   ```

Notes:

- The split workflow uses `compose.dev.yaml`, which mounts `./apps/api` into the
  API container and runs `apps/api/scripts/dev-server.sh` (migrate deploy →
  prisma generate → `nest start --watch`). The script also watches
  `prisma/schema.prisma`: on change it regenerates the Prisma client in the
  container and restarts Nest, so schema edits are picked up without restarting
  the container (docs/dev.md).
- Frontend changes still come from the local Next dev server, so UI edits update
  immediately.
- You still need to restart or rebuild when you change Docker-specific things
  like the API Dockerfile, OS packages, or container-only environment setup.

## Docker Services

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/health`
- PostgreSQL: `postgresql://postgres:postgres@localhost:15432/ava_reader?schema=public`

## Notes

- Database schema lives in `apps/api/prisma/schema.prisma`.
- The Nest app owns database access. Web and mobile should talk to the API, not directly to Postgres.
- Auth is Clerk-backed with custom Next.js sign-in and sign-up flows on `/sign-in` and `/sign-up`.
- `GET /api/me` verifies a Clerk bearer token, fetches the Clerk user, and lazily upserts the local `User` row in Postgres.
- `GET /api/home` aggregates the signed-in dashboard state from real library, catalog, reading, collection, annotation, and feedback records.
- `POST /api/library/import` accepts authenticated EPUB/PDF uploads and stores the original source file in Postgres-backed blobs.
- `POST /api/catalog/:entryId/add-to-library` links a published catalog book into the signed-in user library without duplicating the source book record.
- `POST /api/feedback` persists feedback plus an optional screenshot attachment in Postgres.
- `/app/admin/catalog` is an internal admin route for managing the public-domain catalog from the web app.
- `apps/mobile` is intentionally just a placeholder for now.
- Docker verification runs from a dedicated `verify` container on the same Compose network, so the smoke test checks real in-network connectivity rather than only host access.
- If `3000`, `4000`, or `15432` are already taken on your machine, override them in `.env` or inline when starting Compose, for example `WEB_HOST_PORT=3001 API_HOST_PORT=4001 POSTGRES_HOST_PORT=15433 NEXT_PUBLIC_API_BASE_URL=http://localhost:4001 pnpm docker:up`.

## Admin and Demo Data

- Promote the first local app user to admin after they sign in once:

  ```bash
  pnpm --filter api admin:grant you@example.com
  ```

- Seed a realistic populated home dashboard for an existing local user:

  ```bash
  pnpm --filter api db:seed:home-demo you@example.com
  ```

- Both scripts accept either a local `primaryEmail` or a `clerkUserId`.

## Manual Test Flow

Use this flow when you come back later and want to verify the app quickly end to end.

1. Start the full stack:

   ```bash
   pnpm docker:up
   ```

2. Open `http://localhost:3000/sign-up` and create or sign in to a real Clerk user.

3. Verify the empty signed-in dashboard at `http://localhost:3000/app`.

4. Promote that user to admin from a terminal:

   ```bash
   pnpm --filter api admin:grant you@example.com
   ```

5. Refresh and open the internal catalog route:

   - `http://localhost:3000/app/admin/catalog`

6. Choose one of two paths:

   - Manual catalog path: create public-domain titles in the admin UI, publish them, then add them from the home screen.
   - Demo-data path: seed a realistic populated dashboard immediately:

     ```bash
     pnpm --filter api db:seed:home-demo you@example.com
     ```

7. Refresh `http://localhost:3000/app` and verify the populated dashboard state.

8. Re-run the smoke check when needed:

   ```bash
   pnpm docker:verify
   ```

## Useful Commands

```bash
pnpm docker:up
pnpm docker:down
pnpm docker:verify
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter api admin:grant you@example.com
pnpm --filter api db:seed:home-demo you@example.com
```
