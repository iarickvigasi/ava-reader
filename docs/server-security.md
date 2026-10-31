# Production security

- Public ingress is SSH and HTTP(S): TCP 22/80/443 plus UDP 443. SSH accepts public keys only;
  existing owner and deployment keys remain usable. Forwarding and password authentication are off.
- `tools/security/sshd.conf` installs as `/etc/ssh/sshd_config.d/00-ava-security.conf`.
  Validate with `sshd -t`, reload, and verify fresh owner/deploy key sessions before cancelling rollback.
- UFW denies incoming traffic, permits outgoing traffic, and allows the public ports above on IPv4/IPv6.
  Fail2ban uses the SSH journal and UFW to ban repeated failures (six failures/10m; 24h bans).
- Docker-published traffic also needs `tools/security/docker-firewall.sh`: only original public
  TCP 80/443 and UDP 443 destinations pass external ingress. Established replies and internal Docker
  traffic remain available. The service reapplies both IP families after Docker starts/restarts.
- The public proxy rejects internal API paths before routing and allows only GET/HEAD/OPTIONS
  on catalog routes. Keep these rejections inside an explicitly ordered Caddy `route` block.
- Production application ports bind only to loopback. Caddy connects through the Compose network;
  operator tools retain localhost access. Production databases have no public bindings.
- Caddy writes JSON access logs to persistent `/var/log/caddy`, rolling at 10 MiB or 24h, keeping
  seven compressed backups for at most seven days. Credentials and URI query values are excluded.
  Container console logs also rotate. Never enable credential logging.
- Install host files only as root; back up SSH/firewall configuration first, arm a rollback timer,
  and retain an independent working SSH session until fresh access and HTTPS are verified.
- Apply supported OS security updates and keep automatic security updates enabled. Reboots require
  post-boot SSH, firewall, fail2ban, application-health and storage-mount checks.
- Dependency remediation covers every workspace and runtime/migration image, including transitive
  dependencies and OS packages. Record scanner/database versions and verify fixes with fresh scans;
  distinguish patched findings from unresolved upstream issues. Do not hide findings with ignores.

Runtime and migration images use the audited Alpine Node 22 base, excluding unused global package
managers. Runtime processes use dedicated UID 10001, read-only filesystems and bounded writable caches.
The Jest `deepmerge` advisory has no upstream release: `patches/deepmerge@4.3.1.patch` repairs both
merge operands in every distributed entry point. Regression tests reproduce the original failure.
Registry scans still identify upstream 4.3.1; retain the raw finding alongside verified local patch
evidence instead of claiming the registry itself is clean. The workspace root lockfile is canonical.

The proxy pins upstream jose v3 commit `0e502b87c7aa` for RSA JWK bounds (CVE-2026-116587).
Its disposable vendor tree backports upstream commits `35883f7999e8` (empty CBC ciphertext,
CVE-2026-116585) and `a31af2583622` (JSON depth, CVE-2026-116586) without modifying the module cache.
The build runs the upstream suite plus excessive-depth regressions before compiling the actual binary.
Remove these backports when a maintained upstream release includes all three fixes.
