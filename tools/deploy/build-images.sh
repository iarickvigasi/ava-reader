#!/bin/sh
# Runtime and migration images must always come from the same source revision.
set -eu
[ "$#" -gt 0 ] || exit 0
for service in "$@"; do
  case "$service" in
  api | catalog | web | caddy | postgres) ;;
  *)
    printf 'Unknown application service: %s\n' "$service" >&2
    exit 2
    ;;
  esac
done
build_image() {
  set -- compose -f compose.yaml -f compose.prod.yaml -f compose.security.yaml -f compose.migrations.yaml build "$1"
  if [ -n "${AVA_DEPLOY_BUILDER:-}" ]; then
    set -- "$@" --builder "$AVA_DEPLOY_BUILDER"
  fi
  docker "$@"
}
# Separate definitions do not serialize a multi-service Compose build.
for service in "$@"; do
  printf 'Building image: %s\n' "$service"
  build_image "$service"
  case "$service" in
  api | catalog)
    printf 'Building image: %s-migrate\n' "$service"
    build_image "$service-migrate"
    ;;
  esac
done
