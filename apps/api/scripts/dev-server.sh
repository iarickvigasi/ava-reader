#!/bin/sh
# Dev-container entrypoint for the split workflow (compose.dev.yaml). Docs: docs/dev.md.
# The generated Prisma client lives in the image's pnpm store, not in the ./apps/api bind mount,
# so a host edit of prisma/schema.prisma must trigger an in-container `prisma generate`. Nest is
# then restarted for a clean compile — tsc --watch does not reliably re-read node_modules .d.ts.
set -eu

BIN=/app/node_modules/.pnpm/node_modules/.bin
SCHEMA=prisma/schema.prisma
POLL_SECONDS=2

cd /app/apps/api

"$BIN/prisma" migrate deploy

nest_pid=

# Nest runs in its own process group (setsid): the CLI spawns the app as a grandchild, so killing
# only the CLI orphans the app on port 4000. dash's builtin kill silently no-ops on negative pids;
# node's process.kill is the reliable group kill in this image.
kill_nest_group() {
  [ -n "$nest_pid" ] || return 0
  node -e 'try { process.kill(-Number(process.argv[1]), process.argv[2]) } catch {}' \
    "$nest_pid" "$1"
}

on_terminate() {
  kill_nest_group SIGTERM
  exit 143
}
trap on_terminate TERM INT

while :; do
  echo "[dev-server] prisma generate"
  "$BIN/prisma" generate
  stamp=$(cksum "$SCHEMA")
  setsid "$BIN/nest" start --watch &
  nest_pid=$!
  while kill -0 "$nest_pid" 2>/dev/null; do
    sleep "$POLL_SECONDS"
    if [ "$(cksum "$SCHEMA")" != "$stamp" ]; then
      echo "[dev-server] $SCHEMA changed - regenerating Prisma client and restarting Nest"
      kill_nest_group SIGTERM
      wait "$nest_pid" 2>/dev/null || true
      sleep 1
      kill_nest_group SIGKILL
      nest_pid=
      continue 2
    fi
  done
  exit_code=0
  wait "$nest_pid" || exit_code=$?
  echo "[dev-server] nest exited with code $exit_code"
  exit "$exit_code"
done
