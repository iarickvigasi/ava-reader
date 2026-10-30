#!/bin/sh
# RSA JWK bounds are pinned upstream; the other two CVEs use exact upstream v4 backports.
# Patch a disposable vendor tree, leaving the verified module cache unchanged.
set -eu
jose_source=$(go list -mod=readonly -m -f '{{.Dir}}' github.com/go-jose/go-jose/v3)
go mod vendor
jose_vendor=vendor/github.com/go-jose/go-jose/v3
cp -R "$jose_source/." "$jose_vendor/"
chmod -R u+w "$jose_vendor"
patch -d "$jose_vendor" -p1 <jose-v3.patch
cp depth_test.go.txt "$jose_vendor/json/security_depth_test.go"
