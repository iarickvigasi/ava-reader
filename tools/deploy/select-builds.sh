#!/bin/sh
# Print affected application services, comparing against the last successful rollout.
set -eu
base=${1:-}
target=${2:-HEAD}
if [ -z "$base" ] || ! git merge-base --is-ancestor "$base" "$target" 2>/dev/null; then
  printf '%s\n' api catalog web
  exit 0
fi
paths=$(git diff --name-only --no-renames "$base" "$target")
api= catalog= web=
while IFS= read -r path; do
  case "$path" in
    apps/web/*) web=web ;;
    apps/api/*) api=api ;;
    apps/catalog/*) catalog=catalog ;;
    docs/*|README.md|AGENTS.md|LICENSE|apps/mobile/*|'') ;;
    *) api=api; catalog=catalog; web=web ;;
  esac
done <<EOF_PATHS
$paths
EOF_PATHS
for service in "$api" "$catalog" "$web"; do
  [ -z "$service" ] || printf '%s\n' "$service"
done
