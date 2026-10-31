#!/bin/sh
# Keep Corepack only in build/dev stages; deployed services need Node alone.
set -eu
if [ "${1:-}" = --keep-corepack ]; then
  rm -rf /usr/local/lib/node_modules/npm
else
  rm -rf /usr/local/lib/node_modules /root/.cache/node/corepack
  rm -f /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx
fi
rm -rf /opt/yarn-*
rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
