FROM node:22-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Keep auth redirects same-origin: without these the Clerk middleware falls
# back to the hosted Account Portal, which strands offline tabs in a redirect
# loop when the session can't refresh.
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

WORKDIR /app

RUN corepack enable
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Source edits and the service-worker version must not invalidate dependency installation.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter web --frozen-lockfile

COPY apps/web apps/web

ARG NEXT_PUBLIC_CATALOG_API_BASE_URL=/catalog
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# Commit being built — consumed by next.config.ts to version the service
# worker cache (NEXT_PUBLIC_SW_VERSION). Falls back to a build timestamp when
# unset, so this is optional but gives stable, traceable cache names.
ARG GIT_SHA
ENV NEXT_PUBLIC_CATALOG_API_BASE_URL="$NEXT_PUBLIC_CATALOG_API_BASE_URL"
ENV NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL"
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
ENV GIT_SHA="$GIT_SHA"
RUN pnpm --filter web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
# gen-precache-manifest runs after next build, so copy public from the completed build.
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
