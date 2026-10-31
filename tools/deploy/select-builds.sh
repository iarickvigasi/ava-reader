#!/bin/sh
# Print affected application services, comparing against the last successful rollout.
set -eu
base=${1:-}
target=${2:-HEAD}
if [ -z "$base" ] || ! git merge-base --is-ancestor "$base" "$target" 2>/dev/null; then
  printf '%s\n' api catalog web caddy postgres
  exit 0
fi
paths=$(git diff --name-only --no-renames "$base" "$target")
api='' catalog='' web='' caddy='' postgres=''
while IFS= read -r path; do
  case "$path" in
  apps/web/*) web=web ;;
  apps/api/*) api=api ;;
  apps/catalog/*) catalog=catalog ;;
  tools/security/caddy/* | tools/security/caddy.Dockerfile) caddy=caddy ;;
  tools/security/postgres.Dockerfile | tools/security/gosu.sh) postgres=postgres ;;
  docs/* | README.md | AGENTS.md | LICENSE | apps/mobile/* | '') ;;
  *)
    api=api
    catalog=catalog
    web=web
    caddy=caddy
    postgres=postgres
    ;;
  esac
done <<EOF_PATHS
$paths
EOF_PATHS
for service in "$api" "$catalog" "$web" "$caddy" "$postgres"; do
  [ -z "$service" ] || printf '%s\n' "$service"
done
