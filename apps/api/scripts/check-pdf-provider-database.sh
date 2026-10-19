#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/../../.." && pwd)
image=postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777
docker_bin=${AVA_CI_DOCKER_BINARY:-docker}
node_bin=${AVA_CI_NODE_BINARY:-node}
if [[ ! -f "$repo/apps/api/dist/library/pdf-import/providers/dispatch.js" ]]; then
  printf '%s\n' 'Build the API before running the provider database regression.' >&2
  exit 1
fi
if ! "$docker_bin" image inspect "$image" >/dev/null 2>&1; then "$docker_bin" pull "$image"; fi
container=
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n "$container" ]]; then
    if [[ "$status" -ne 0 ]]; then "$docker_bin" logs "$container" >&2 || true; fi
    if ! "$docker_bin" rm --force "$container" >/dev/null; then exit 1; fi
  fi
  exit "$status"
}
trap cleanup EXIT
container=$("$docker_bin" run --detach --pull never --label ava.test=pdf-provider-database --read-only \
  --publish 127.0.0.1::5432 --user postgres --cpus 1 --memory 512m --pids-limit 128 --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,nosuid,nodev,size=67108864,mode=1777 \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=1048576,mode=1777 \
  --tmpfs /data:rw,nosuid,nodev,size=268435456,mode=1777 \
  -e PGDATA=/data/pgdata -e POSTGRES_PASSWORD=ava-ephemeral-test-only "$image" postgres)
ready=false
for ((attempt=0;attempt<60;attempt++)); do
  if [[ $("$docker_bin" inspect --format '{{.State.Running}}' "$container") != true ]]; then exit 1; fi
  if "$docker_bin" exec "$container" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -h /var/run/postgresql -U postgres' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.5
done
if [[ "$ready" != true ]]; then exit 1; fi
endpoint=$("$docker_bin" port "$container" 5432/tcp)
if [[ ! "$endpoint" =~ ^127\.0\.0\.1:([0-9]{4,5})$ ]]; then exit 1; fi
port=${BASH_REMATCH[1]}
"$docker_bin" exec "$container" createdb -h /var/run/postgresql -U postgres ava_pdf_provider_ci
for migration in "$repo"/apps/api/prisma/migrations/*/migration.sql; do
  "$docker_bin" exec -i "$container" psql -h /var/run/postgresql -U postgres -d ava_pdf_provider_ci -X -v ON_ERROR_STOP=1 < "$migration" >/dev/null
done
# Constant disposable credentials only; real .env files and existing databases are never read.
env -u NODE_OPTIONS AVA_PDF_DATABASE_TEST_URL="postgresql://postgres:ava-ephemeral-test-only@127.0.0.1:$port/ava_pdf_provider_ci" \
  "$node_bin" "$repo/apps/api/scripts/pdf-provider-database/check.cjs"
