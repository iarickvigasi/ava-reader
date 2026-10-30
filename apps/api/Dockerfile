FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS dependencies

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

COPY tools/security/remove-node-tools.sh /remove-node-tools.sh
RUN corepack enable && sh /remove-node-tools.sh --keep-corepack
RUN apk upgrade --no-cache && apk add --no-cache openssl

# Cache dependencies until manifests or Prisma generation inputs change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY patches ./patches
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/prisma apps/api/prisma
RUN DATABASE_URL=postgresql://build:build@build:5432/build pnpm install --filter api --frozen-lockfile

FROM dependencies AS build
COPY apps/api apps/api
RUN pnpm --filter api build

# The migration target keeps CLI tooling outside the production server image.
FROM dependencies AS migration
WORKDIR /app/apps/api
RUN sh /remove-node-tools.sh
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM build AS production-dependencies
COPY tools/deploy/prepare-runtime-dependencies.mjs /prepare-runtime-dependencies.mjs
RUN pnpm --filter api --config.inject-workspace-packages=true --config.ignore-scripts=true deploy --prod /production \
    && node /prepare-runtime-dependencies.mjs api /production

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY tools/security/remove-node-tools.sh /remove-node-tools.sh
RUN sh /remove-node-tools.sh
COPY tools/security/create-runtime-user.sh /create-runtime-user.sh
RUN sh /create-runtime-user.sh
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY --from=production-dependencies /production/node_modules /app/node_modules
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
EXPOSE 4000
USER ava
CMD ["node", "dist/main.js"]

# Preserve migration-on-start and maintenance commands for local Compose.
FROM build AS development
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter api db:migrate:deploy && pnpm --filter api start:prod"]
