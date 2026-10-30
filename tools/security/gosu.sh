#!/bin/sh
# The official PostgreSQL entrypoint only needs user/group switching.
exec su-exec "$@"
