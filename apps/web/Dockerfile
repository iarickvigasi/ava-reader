FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Keep auth redirects same-origin: without these the Clerk middleware falls
# back to the hosted Account Portal, which strands offline tabs in a redirect
# loop when the session can't refresh.
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

WORKDIR /app

COPY tools/security/remove-node-tools.sh /remove-node-tools.sh
RUN corepack enable && sh /remove-node-tools.sh --keep-corepack
RUN apk upgrade --no-cache && apk add --no-cache openssl

# Source edits and the service-worker version must not invalidate dependency installation.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY patches ./patches
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

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY tools/security/remove-node-tools.sh /remove-node-tools.sh
RUN sh /remove-node-tools.sh
COPY tools/security/create-runtime-user.sh /create-runtime-user.sh
RUN sh /create-runtime-user.sh
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --chown=ava:ava --from=build /app/apps/web/.next/standalone ./
COPY --chown=ava:ava --from=build /app/apps/web/.next/static ./apps/web/.next/static
# gen-precache-manifest runs after next build, so copy public from the completed build.
COPY --chown=ava:ava --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
USER ava
CMD ["node", "apps/web/server.js"]
