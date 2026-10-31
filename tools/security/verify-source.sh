#!/bin/sh
set -eu
export DATABASE_URL=postgresql://build:build@localhost:5432/build
export CATALOG_DATABASE_URL=postgresql://build:build@localhost:5432/build
mkdir -p security-reports
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
node --test tools/deploy/*.test.mjs tools/security/*.test.mjs
node tools/security/audit-dependencies.mjs security-reports/npm-audit.json
pnpm --filter api test --runInBand
pnpm --filter catalog test --runInBand
pnpm --filter web test --maxWorkers=2
pnpm --filter api build
pnpm --filter catalog build
