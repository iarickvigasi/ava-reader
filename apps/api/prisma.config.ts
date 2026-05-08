import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma CLI config. Loaded by `prisma` commands at runtime via Prisma's
 * own loader — there is no static TS consumer, so editors may flag the
 * default export as "unused". That is expected for tooling-loaded configs.
 *
 * `import 'dotenv/config'` is required because Prisma 7's `defineConfig`
 * does not auto-load .env files (unlike the legacy `env(...)` directive
 * inside schema.prisma). Without it, host-side CLI commands fall back to
 * `process.env` only, miss the dockerised Postgres host port, and fail
 * with `P1001: Can't reach database server at localhost:5432`.
 *
 * `env('DATABASE_URL')` from `prisma/config` throws a clear error if the
 * variable is missing, so we no longer silently fall back to a hardcoded
 * default that masks misconfiguration.
 *
 * @public
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
