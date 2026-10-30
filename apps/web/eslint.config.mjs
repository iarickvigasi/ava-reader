import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ADR 4 loaders deliberately initialize browser-only state after hydration.
  // Keep their existing reconnect and cancellation behavior during security upgrades.
  {
    files: [
      "components/app/library/book-info/book-info-loader.tsx",
      "components/app/library/collection/use-collection-loader.ts",
      "features/explore/use-catalog-read.ts",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
