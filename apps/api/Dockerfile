FROM node:22-bookworm-slim AS dependencies

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Cache dependencies until manifests or Prisma generation inputs change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/prisma apps/api/prisma
RUN DATABASE_URL=postgresql://build:build@build:5432/build pnpm install --filter api --frozen-lockfile

FROM dependencies AS build
COPY apps/api apps/api
RUN pnpm --filter api build

# The migration target keeps CLI tooling outside the production server image.
FROM dependencies AS migration
CMD ["pnpm", "--filter", "api", "db:migrate:deploy"]

FROM build AS production-dependencies
COPY tools/deploy/prepare-runtime-dependencies.mjs /prepare-runtime-dependencies.mjs
RUN pnpm --filter api --config.inject-workspace-packages=true --config.ignore-scripts=true deploy --prod /production \
    && node /prepare-runtime-dependencies.mjs api /production

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=production-dependencies /production/node_modules /app/node_modules
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
EXPOSE 4000
CMD ["node", "dist/main.js"]

# Preserve migration-on-start and maintenance commands for local Compose.
FROM build AS development
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter api db:migrate:deploy && pnpm --filter api start:prod"]
