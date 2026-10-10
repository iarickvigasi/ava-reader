# Same immutable Python/uv inputs as the isolated converter. The API installs only
# its semantic package here; converter execution still needs a qualified runner.
FROM ghcr.io/astral-sh/uv:0.9.26@sha256:9a23023be68b2ed09750ae636228e903a54a05ea56ed03a934d00fe9fbeded4b AS uv
FROM python:3.12.14-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e AS python-runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN printf '%s\n' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260927T000000Z bookworm main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260927T000000Z bookworm-updates main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20260927T000000Z bookworm-security main' \
      > /etc/apt/sources.list \
    && rm /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends libstdc++6=12.2.0-14+deb12u1 openssl=3.0.20-1~deb12u2 \
    && mkdir -p /usr/share/ava \
    && dpkg-query -W -f='${Package}\t${Version}\n' > /usr/share/ava/api-native-dependencies.tsv \
    && rm -rf /var/lib/apt/lists/*

FROM python-runtime AS contracts-build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never UV_NO_CACHE=1
WORKDIR /opt/ava-contracts
COPY packages/pdf-epub/pyproject.toml packages/pdf-epub/uv.lock packages/pdf-epub/README.md ./
COPY packages/pdf-epub/src ./src
RUN uv sync --locked --no-dev --no-editable

FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS api-build
WORKDIR /app
# Node slim omits system CAs; bootstrap HTTPS APT from the pinned public bundle.
COPY --from=python-runtime /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
RUN printf '%s\n' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260927T000000Z bookworm main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260927T000000Z bookworm-updates main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20260927T000000Z bookworm-security main' \
      > /etc/apt/sources.list \
    && rm /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl=3.0.20-1~deb12u2 \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/nest-cli.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/src ./apps/api/src
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:1/build pnpm install --filter api --frozen-lockfile \
    && pnpm --filter api build

FROM python-runtime AS api-common
ENV AVA_PDF_CONTRACT_PYTHON=/opt/ava-contracts/.venv/bin/python \
    AVA_PDF_RUNTIME_ENABLED=0
COPY --from=api-build /usr/local/bin/node /usr/local/bin/node
COPY --from=contracts-build /opt/ava-contracts/.venv /opt/ava-contracts/.venv
COPY --from=api-build /app/node_modules /app/node_modules
COPY --from=api-build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=api-build /app/apps/api/dist /app/apps/api/dist
COPY --from=api-build /app/apps/api/prisma /app/apps/api/prisma
COPY --from=api-build /app/apps/api/prisma.config.ts /app/apps/api/package.json /app/apps/api/
WORKDIR /app/apps/api
EXPOSE 4000
# Preserve migration-before-start; serialization/restore and graceful drain still
# require their operational qualification. No Docker CLI or engine access is added.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && exec node dist/main"]

# compose.dev.yaml supplies the API source bind and its existing watch entrypoint.
# Keep its generated Prisma client writable without changing production ownership.
FROM api-common AS api-development
ENV NODE_ENV=development

FROM api-common AS api-runtime
ENV NODE_ENV=production
RUN useradd --uid 10001 --create-home api
USER 10001:10001
