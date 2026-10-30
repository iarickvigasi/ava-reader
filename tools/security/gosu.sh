#!/bin/sh
# The official PostgreSQL entrypoint only needs user/group switching.
# The base /usr/local/bin/su-exec link points back to gosu.
exec /sbin/su-exec "$@"
