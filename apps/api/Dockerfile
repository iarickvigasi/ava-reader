FROM node:22-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter api db:migrate:deploy && pnpm --filter api start:prod"]
