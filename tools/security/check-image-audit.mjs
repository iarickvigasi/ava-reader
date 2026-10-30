import { readFileSync, existsSync } from "node:fs";

const [service, filename] = process.argv.slice(2);
const report = JSON.parse(readFileSync(filename, "utf8"));
if (
  report.Metadata?.OS?.Family !== "alpine" ||
  !report.Results?.some(({ Packages }) => Packages?.length)
)
  throw new Error("Image scan did not identify the OS/packages");
if (
  service === "caddy" &&
  !report.Results.some(({ Type }) => Type === "gobinary")
)
  throw new Error("Proxy binary was not scanned");
if (
  ["api", "catalog", "web", "api-migrate", "catalog-migrate"].includes(
    service,
  ) &&
  !report.Results.some(({ Type }) => Type === "node-pkg")
)
  throw new Error("Application packages were not scanned");
const packages =
  service === "caddy"
    ? readFileSync("security-reports/caddy-packages.txt", "utf8")
        .trim()
        .split("\n")
    : [];
if (
  service === "caddy" &&
  !packages.includes("github.com/caddyserver/caddy/v2")
)
  throw new Error("Missing proxy import graph");
const findings = report.Results.flatMap(
  ({ Vulnerabilities }) => Vulnerabilities || [],
);
const verified = [],
  remaining = [];
for (const finding of findings) {
  const patchedMerge =
    service.endsWith("-migrate") &&
    finding.VulnerabilityID === "CVE-2026-93753" &&
    finding.PkgName === "deepmerge" &&
    finding.InstalledVersion === "4.3.1" &&
    finding.PkgPath?.includes("_patch_hash=") &&
    existsSync(`security-reports/${service}-patch.verified`);
  const patchedJose =
    service === "caddy" &&
    ["CVE-2026-116585", "CVE-2026-116586", "CVE-2026-116587"].includes(
      finding.VulnerabilityID,
    ) &&
    finding.PkgName === "github.com/go-jose/go-jose/v3" &&
    finding.InstalledVersion === "v3.0.6-0.20261030183946-0e502b87c7aa" &&
    existsSync("security-reports/caddy-jose.verified");
  const absentOpenPgp =
    service === "caddy" &&
    finding.VulnerabilityID === "GO-2026-5932" &&
    finding.PkgName === "golang.org/x/crypto" &&
    !packages.some((name) => name.startsWith("golang.org/x/crypto/openpgp"));
  (patchedMerge || patchedJose || absentOpenPgp ? verified : remaining).push(
    finding,
  );
}
console.log(
  `${service}: ${findings.length} raw findings, ${verified.length} locally fixed/component absent, ${remaining.length} unresolved`,
);
for (const finding of [...verified, ...remaining])
  console.log(
    `${finding.VulnerabilityID} ${finding.PkgName} ${finding.InstalledVersion}`,
  );
if (remaining.length) process.exitCode = 1;
