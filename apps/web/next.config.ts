import { resolve } from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { resolveCatalogApiBase } from "./scripts/catalog-api-base.mjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Per-build identifier handed to the service worker so it can name (and on
// activate, evict) its caches. Prefer a deploy-provided SHA; otherwise fall
// back to the build timestamp. Evaluated once when `next build` loads this
// config, so it's stable for the whole build and changes on every new build —
// exactly what we want for cache busting. Inlined into the client bundle via
// `env` as NEXT_PUBLIC_SW_VERSION.
const SW_VERSION =
  process.env.GIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  `build-${Date.now()}`;

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(__dirname, "../.."),
  env: {
    NEXT_PUBLIC_SW_VERSION: SW_VERSION,
    NEXT_PUBLIC_CATALOG_API_BASE_URL: resolveCatalogApiBase(
      process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL,
      process.env.NODE_ENV === "production",
    ),
  },
};

export default withNextIntl(nextConfig);
