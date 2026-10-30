#!/bin/sh
# Keep production builds inside a bounded cgroup instead of exhausting the host.
set -eu
builder=${1:?A deployment builder name is required}
if ! docker buildx inspect "$builder" >/dev/null 2>&1; then
  docker buildx create --name "$builder" --driver docker-container \
    --driver-opt memory=2560m,memory-swap=2560m,cpu-period=100000,cpu-quota=150000,default-load=true
fi
docker buildx inspect "$builder" --bootstrap
