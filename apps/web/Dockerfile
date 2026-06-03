FROM node:22-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# Commit being built — consumed by next.config.ts to version the service
# worker cache (NEXT_PUBLIC_SW_VERSION). Falls back to a build timestamp when
# unset, so this is optional but gives stable, traceable cache names.
ARG GIT_SHA
ENV NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL"
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
ENV GIT_SHA="$GIT_SHA"

WORKDIR /app

RUN corepack enable
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY . .

RUN DATABASE_URL=postgresql://build:build@build:5432/build pnpm install --frozen-lockfile
RUN pnpm --filter web build

EXPOSE 3000

CMD ["sh", "-c", "cd apps/web && pnpm exec next start --hostname 0.0.0.0 --port 3000"]
