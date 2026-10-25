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
- Run `db:migrate:deploy` in one-off API and catalog containers (`run --rm --no-deps -T`).
  These use the new images and production environment without publishing application ports.
- Only after both migrations succeed, start application services with `up -d --no-build --wait`,
  then verify public endpoints. Migration failure stops deployment before application replacement.
- Production API/catalog commands start the server directly; they do not run migrations. Manual
  deployments must follow the same order as `.github/workflows/deploy.yml`. Local Compose keeps
  its existing migration-on-start behavior. Long migrations use the SSH command's 30m budget,
  separate from application health checks; they must remain compatible with running old services.
