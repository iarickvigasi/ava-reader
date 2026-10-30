FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS dependencies
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
COPY tools/security/remove-node-tools.sh /remove-node-tools.sh
RUN corepack enable && sh /remove-node-tools.sh --keep-corepack
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/catalog/package.json apps/catalog/package.json
COPY patches ./patches
COPY apps/catalog/prisma.config.ts apps/catalog/prisma.config.ts
COPY apps/catalog/prisma apps/catalog/prisma
RUN pnpm install --filter catalog --frozen-lockfile
FROM dependencies AS build
COPY apps/catalog apps/catalog
RUN pnpm --filter catalog build
FROM dependencies AS migration
WORKDIR /app/apps/catalog
RUN sh /remove-node-tools.sh
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM build AS production-dependencies
COPY tools/deploy/prepare-runtime-dependencies.mjs /prepare-runtime-dependencies.mjs
RUN pnpm --filter catalog --config.inject-workspace-packages=true --config.ignore-scripts=true deploy --prod /production \
    && node /prepare-runtime-dependencies.mjs catalog /production

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runtime
WORKDIR /app/apps/catalog
ENV NODE_ENV=production
COPY tools/security/remove-node-tools.sh /remove-node-tools.sh
RUN sh /remove-node-tools.sh
COPY tools/security/create-runtime-user.sh /create-runtime-user.sh
RUN sh /create-runtime-user.sh
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY --from=production-dependencies /production/node_modules /app/node_modules
COPY --from=build /app/apps/catalog/package.json ./package.json
COPY --from=build /app/apps/catalog/generated ./generated
COPY --from=build /app/apps/catalog/dist ./dist
EXPOSE 4001
USER ava
CMD ["node", "dist/src/main.js"]

FROM build AS development
EXPOSE 4001
CMD ["sh", "-c", "pnpm --filter catalog db:migrate:deploy && pnpm --filter catalog start:prod"]
