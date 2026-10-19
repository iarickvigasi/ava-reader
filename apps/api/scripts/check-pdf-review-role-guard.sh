#!/usr/bin/env bash
set -euo pipefail

# Fresh public-schema migration chain, no keys/ports/host volumes or shared database.
repo=$(cd "$(dirname "$0")/../../.." && pwd)
image=postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777
docker_bin=${AVA_CI_DOCKER_BINARY:-docker}
if ! "$docker_bin" image inspect "$image" >/dev/null 2>&1; then
  "$docker_bin" pull "$image"
fi
container=
cleanup() {
  local original_status=$?
  trap - EXIT
  if [[ -n "$container" ]]; then
    if [[ "$original_status" -ne 0 ]]; then
      "$docker_bin" logs "$container" >&2 || true
    fi
    if ! "$docker_bin" rm --force "$container" >/dev/null; then
      exit 1
    fi
  fi
  exit "$original_status"
}
trap cleanup EXIT
container=$("$docker_bin" run --detach --pull never --label ava.test=pdf-review-role-guard --network none --read-only \
  --user postgres --cpus 1 --memory 512m --pids-limit 128 --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,nosuid,nodev,size=67108864,mode=1777 \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=1048576,mode=1777 \
  --tmpfs /data:rw,nosuid,nodev,size=268435456,mode=1777 \
  -e PGDATA=/data/pgdata -e POSTGRES_PASSWORD=ava-ephemeral-test-only \
  "$image" postgres)
printf 'Disposable PostgreSQL container: %s\n' "$container"
ready=false
for ((attempt=0;attempt<60;attempt++)); do
  pg_running=$("$docker_bin" inspect --format '{{.State.Running}}' "$container")
  if [[ "$pg_running" != true ]]; then
    exit 1
  fi
  if "$docker_bin" exec "$container" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -h /var/run/postgresql -U postgres' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.5
done
if [[ "$ready" != true ]]; then
  exit 1
fi
for migration in "$repo"/apps/api/prisma/migrations/*/migration.sql; do
  "$docker_bin" exec -i "$container" psql -h /var/run/postgresql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < "$migration" >/dev/null
done
"$docker_bin" exec -i "$container" psql -h /var/run/postgresql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < "$repo/apps/api/scripts/check-pdf-review-role-guard.sql"
