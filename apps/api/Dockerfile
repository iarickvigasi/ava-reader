FROM node:22-bookworm-slim

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

COPY apps/api apps/api
RUN pnpm --filter api build

EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter api db:migrate:deploy && pnpm --filter api start:prod"]
