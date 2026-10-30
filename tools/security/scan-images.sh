#!/bin/sh
set -eu
scan_dir=$(mktemp -d)
trap 'rm -rf "$scan_dir"' EXIT
mkdir -p security-reports
version=0.76.1
archive=trivy_0.76.1_Linux-64bit.tar.gz
curl --fail --location --retry 3 --max-time 180 -o "$scan_dir/$archive" \
  "https://github.com/aquasecurity/trivy/releases/download/v$version/$archive"
printf '%s  %s\n' c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0 "$scan_dir/$archive" | sha256sum -c -
tar -xzf "$scan_dir/$archive" -C "$scan_dir" trivy
"$scan_dir/trivy" --version >security-reports/scanner-version.txt
status=0
for service in api catalog web api-migrate catalog-migrate postgres caddy; do
  image="ava-reader-security-$service:latest"
  case "$service" in
  *-migrate)
    app=${service%-migrate}
    rm -f "security-reports/$service-patch.verified"
    if docker run --rm --network none --read-only --cap-drop ALL --user node \
      -e AVA_DEEPMERGE_PACKAGE="/app/apps/$app/package.json" \
      --mount "type=bind,src=$PWD/tools/security/deepmerge.test.mjs,dst=/tmp/deepmerge.test.mjs,readonly" \
      --entrypoint node "$image" --test /tmp/deepmerge.test.mjs >"security-reports/$service-patch-tests.txt"; then
      touch "security-reports/$service-patch.verified"
    else
      status=1
    fi
    ;;
  esac
  if ! docker image save --output "$scan_dir/image.tar" "$image"; then
    status=1
    continue
  fi
  if ! "$scan_dir/trivy" image --input "$scan_dir/image.tar" --scanners vuln --no-progress \
    --list-all-pkgs --format json --output "security-reports/$service.json" --timeout 10m; then
    status=1
    continue
  fi
  if ! node tools/security/check-image-audit.mjs "$service" "security-reports/$service.json"; then status=1; fi
  rm -f "$scan_dir/image.tar"
done
exit "$status"
