#!/bin/sh
# Runtime and migration images must always come from the same source revision.
set -eu
[ "$#" -gt 0 ] || exit 0
for service in "$@"; do
  case "$service" in
    api|catalog|web) ;;
    *) printf 'Unknown application service: %s\n' "$service" >&2; exit 2 ;;
  esac
done
# Separate definitions do not serialize a multi-service Compose build.
for service in "$@"; do
  printf 'Building image: %s\n' "$service"
  docker compose -f compose.yaml -f compose.prod.yaml -f compose.migrations.yaml build "$service"
  case "$service" in
    api|catalog)
      printf 'Building image: %s-migrate\n' "$service"
      docker compose -f compose.yaml -f compose.prod.yaml -f compose.migrations.yaml build "$service-migrate"
      ;;
  esac
done
