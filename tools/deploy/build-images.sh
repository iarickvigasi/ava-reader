#!/bin/sh
# Runtime and migration images must always come from the same source revision.
set -eu
[ "$#" -gt 0 ] || exit 0
for service in "$@"; do
  case "$service" in
    api|catalog) set -- "$@" "$service-migrate" ;;
    web) ;;
    *) printf 'Unknown application service: %s\n' "$service" >&2; exit 2 ;;
  esac
done
docker compose -f compose.yaml -f compose.prod.yaml -f compose.migrations.yaml build "$@"
