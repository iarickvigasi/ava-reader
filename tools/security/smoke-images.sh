#!/bin/sh
set -eu
export AVA_IMAGE_PREFIX=ava-reader-security AVA_POSTGRES_PASSWORD=security-test-only
export CATALOG_POSTGRES_PASSWORD=security-test-only READING_ASSET_SYNC_SECRET=security-test-only
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk
project=ava-security-smoke-$$
smoke_dir=$(mktemp -d)
export AVA_TEST_CADDYFILE="$smoke_dir/Caddyfile" AVA_TEST_LOGDIR="$smoke_dir/logs"
mkdir -p "$AVA_TEST_LOGDIR" security-reports
chmod 777 "$AVA_TEST_LOGDIR"
node -e 'const fs=require("node:fs");let s=fs.readFileSync("Caddyfile","utf8");s=s.replace("avareader.space {","http://localhost:8080 {").replace("http://178.105.20.108 {","http://localhost:8081 {");fs.writeFileSync(process.argv[1],s)' "$AVA_TEST_CADDYFILE"
compose() {
  docker compose --project-name "$project" -f compose.yaml -f compose.security.yaml \
    -f compose.migrations.yaml -f compose.security-test.yaml "$@"
}
finish() {
  status=$?
  trap - EXIT
  compose logs --no-color >security-reports/smoke.log 2>&1 || true
  compose down --volumes --remove-orphans || status=1
  rm -rf "$smoke_dir"
  exit "$status"
}
trap finish EXIT
compose up -d --no-build --wait postgres catalog-postgres
compose run --rm --no-deps -T api-migrate
compose run --rm --no-deps -T catalog-migrate
compose up -d --no-build --wait
base="http://$(compose port caddy 8080)"
curl --fail --silent --show-error --max-time 15 "$base/" >/dev/null
curl --fail --silent --show-error --max-time 15 "$base/api/health"
curl --fail --silent --show-error --max-time 15 -H 'Authorization: Bearer ava-audit-marker' \
  -H 'Cookie: audit=ava-audit-marker' "$base/catalog/api/health?audit=ava-audit-marker"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/api/internal/reading-imports")" = 404 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/catalog/api/internal/editorial")" = 404 ]
[ "$(curl -s -X POST -o /dev/null -w '%{http_code}' "$base/catalog/api/reading-assets/blobs")" = 405 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/api/me")" = 401 ]
caddy_id=$(compose ps -q caddy)
docker exec "$caddy_id" cat /var/log/caddy/access.log >security-reports/access-log.jsonl
node -e 'const fs=require("node:fs");const t=fs.readFileSync("security-reports/access-log.jsonl","utf8");if(!t.trim()||t.includes("ava-audit-marker"))throw Error("Access log missing or leaked credentials/query data");console.log("Security smoke checks passed")'
