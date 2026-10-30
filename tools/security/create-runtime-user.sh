#!/bin/sh
set -eu
# Keep application identities distinct from the host deployment account (UID 1000).
addgroup -S -g 10001 ava
adduser -S -D -H -s /sbin/nologin -u 10001 -G ava ava
