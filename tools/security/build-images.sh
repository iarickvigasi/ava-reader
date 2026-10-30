#!/bin/sh
set -eu
export AVA_DEPLOY_BUILDER=ava-security-builder
export AVA_IMAGE_PREFIX=ava-reader-security
export COMPOSE_PROJECT_NAME=ava-reader-security
export AVA_POSTGRES_PASSWORD=security-test-only
export READING_ASSET_SYNC_SECRET=security-test-only
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk
export NEXT_PUBLIC_API_BASE_URL=/api
export NEXT_PUBLIC_CATALOG_API_BASE_URL=/catalog
GIT_SHA="$(git rev-parse HEAD)"
export GIT_SHA
sh tools/deploy/prepare-builder.sh "$AVA_DEPLOY_BUILDER"
sh tools/deploy/build-images.sh api catalog web postgres caddy
