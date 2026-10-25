# Production deployment

- `.github/workflows/deploy.yml` allows 30m for the SSH command. Before pulls/builds it checks
  the checkout, `/tmp`, Docker's data directory, and the attached volume for 2 GiB and 10000
  free inodes each,
  and logs filesystem/Docker usage. It warns below 5 GiB. These initial thresholds do not
  guarantee build capacity; peak build disk usage remains unmeasured.
- Before building and on shell exit (including failure), cleanup removes build cache unused for
  24h with a 5GB cache retention target, plus dangling images older than 24h. Each prune has a 60s limit;
  cleanup warnings preserve the deployment exit status. Volumes are never pruned. A hard kill
  cannot run the exit trap; the next deployment repeats cleanup before checking storage.

## Migration and startup order

- Build API/catalog/web images, then start and wait for both PostgreSQL services.
- Run the `api-migrate` and `catalog-migrate` one-off services (`run --rm --no-deps -T`).
  These use the new images and production environment without publishing application ports.
- Only after both migrations succeed, start application services with `up -d --no-build --wait`,
  then verify public endpoints. Migration failure stops deployment before application replacement.
- Production API/catalog commands start the server directly; they do not run migrations. Manual
  deployments must follow the same order as `.github/workflows/deploy.yml`. Local Compose keeps
  its existing migration-on-start behavior. Long migrations use the SSH command's 30m budget,
  separate from application health checks; they must remain compatible with running old services.

## Selective builds and caching

- `tools/deploy/select-builds.sh` compares the checkout with `.git/ava-last-successful-deploy`.
  Web/API/catalog paths select their own image; docs/README/agent guidance/mobile changes skip
  builds. Shared or unknown paths conservatively select all three. Missing images are rebuilt.
- First deploy, missing/non-ancestor baseline, or `.git/ava-deploy-in-progress` rebuilds all.
  The pending marker is written before builds; only a healthy, publicly verified rollout advances
  the success marker and removes it. Failed builds/rollouts cannot become the next baseline.
- Workflow concurrency serializes deployments. Migrations and health checks still run when images
  are unchanged. Server-only build-argument changes require a full build: remove the success marker
  before the next deploy. This also provides an explicit full-build override.
- Web/API install only their workspace dependencies before copying application source. Web build
  arguments, including `GIT_SHA`, are set afterward so they do not invalidate the dependency layer.
  A skipped web build retains its existing service-worker version.

Deployment regression checks: `node --test tools/deploy/*.test.mjs`.

## Runtime images

- Production selects `runtime` targets: web ships Next standalone output/static/public (including
  the post-build precache manifest); API/catalog ship compiled JS, production dependencies, and
  generated Prisma clients. Build tools and source stay in intermediate stages.
- `api-migrate`/`catalog-migrate` profile services select the `migration` targets and retain Prisma
  CLI tooling. These services live in `compose.migrations.yaml`, added only for build/migration
  commands. `tools/deploy/build-images.sh` builds matching migration images whenever an API or
  catalog image is selected; missing migration images also trigger that service's build.
- The catalog runtime retains its compiled importer and existing worker entrypoint. Local API and
  catalog builds default to the `development` target, retaining migration-on-start/maintenance tools.
- `prepare-runtime-dependencies.mjs` preserves generated API client files and removes Prisma's
  optional CLI/TypeScript peers from production bundles. Other optional dependencies are preserved.
  Build/migration targets and build cache still consume storage; runtime size is not total disk use.
