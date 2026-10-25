FROM node:22-bookworm-slim AS dependencies
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/catalog/package.json apps/catalog/package.json
COPY apps/catalog/prisma.config.ts apps/catalog/prisma.config.ts
COPY apps/catalog/prisma apps/catalog/prisma
RUN pnpm install --filter catalog --frozen-lockfile
FROM dependencies AS build
COPY apps/catalog apps/catalog
RUN pnpm --filter catalog build
FROM dependencies AS migration
CMD ["pnpm", "--filter", "catalog", "db:migrate:deploy"]

FROM build AS production-dependencies
COPY tools/deploy/prepare-runtime-dependencies.mjs /prepare-runtime-dependencies.mjs
RUN pnpm --filter catalog --config.inject-workspace-packages=true --config.ignore-scripts=true deploy --prod /production \
    && node /prepare-runtime-dependencies.mjs catalog /production

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/apps/catalog
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=production-dependencies /production/node_modules /app/node_modules
COPY --from=build /app/apps/catalog/package.json ./package.json
COPY --from=build /app/apps/catalog/generated ./generated
COPY --from=build /app/apps/catalog/dist ./dist
EXPOSE 4001
CMD ["node", "dist/src/main.js"]

FROM build AS development
EXPOSE 4001
CMD ["sh", "-c", "pnpm --filter catalog db:migrate:deploy && pnpm --filter catalog start:prod"]
