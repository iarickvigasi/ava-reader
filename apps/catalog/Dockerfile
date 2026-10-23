FROM node:22-bookworm-slim
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
COPY apps/catalog apps/catalog
RUN pnpm --filter catalog build
EXPOSE 4001
CMD ["sh", "-c", "pnpm --filter catalog db:migrate:deploy && pnpm --filter catalog start:prod"]
