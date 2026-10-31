#!/bin/sh
set -eu
: "${SSH_HOST:?Missing SSH_HOST}" "${SSH_USER:?Missing SSH_USER}" "${SSH_PRIVATE_KEY:?Missing SSH_PRIVATE_KEY}"
deploy_ssh_dir=$(mktemp -d "${RUNNER_TEMP:-/tmp}/ava-deploy-ssh.XXXXXX")
trap 'rm -rf "$deploy_ssh_dir"' EXIT
(
  umask 077
  printf '%s\n' "$SSH_PRIVATE_KEY" >"$deploy_ssh_dir/key"
)
unset SSH_PRIVATE_KEY
timeout 30m ssh -T -i "$deploy_ssh_dir/key" \
  -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o HostKeyAlias=ava-production -o HostKeyAlgorithms=ssh-ed25519 \
  -o UserKnownHostsFile=tools/deploy/known-hosts -o GlobalKnownHostsFile=/dev/null \
  -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no \
  -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -p "${SSH_PORT:-22}" -l "$SSH_USER" -- "$SSH_HOST" sh -s <tools/deploy/deploy.sh
