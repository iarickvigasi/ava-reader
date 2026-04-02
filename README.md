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
   - API health: `http://localhost:4000/api/health`
   - API current user: `GET http://localhost:4000/api/me` with a Clerk bearer token
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

## Docker Services

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/health`
- PostgreSQL: `postgresql://postgres:postgres@localhost:15432/ava_reader?schema=public`

## Notes

- Database schema lives in `apps/api/prisma/schema.prisma`.
- The Nest app owns database access. Web and mobile should talk to the API, not directly to Postgres.
- Auth is Clerk-backed with custom Next.js sign-in and sign-up flows on `/sign-in` and `/sign-up`.
- `GET /api/me` verifies a Clerk bearer token, fetches the Clerk user, and lazily upserts the local `User` row in Postgres.
- `apps/mobile` is intentionally just a placeholder for now.
- Docker verification runs from a dedicated `verify` container on the same Compose network, so the smoke test checks real in-network connectivity rather than only host access.
- If `3000`, `4000`, or `15432` are already taken on your machine, override them in `.env` or inline when starting Compose, for example `WEB_HOST_PORT=3001 API_HOST_PORT=4001 POSTGRES_HOST_PORT=15433 NEXT_PUBLIC_API_BASE_URL=http://localhost:4001 pnpm docker:up`.
