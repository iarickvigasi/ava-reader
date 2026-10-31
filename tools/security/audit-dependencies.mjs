import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const result = spawnSync("pnpm", ["audit", "--json"], {
  encoding: "utf8",
  timeout: 120000,
  maxBuffer: 16 * 1024 * 1024,
});
if (![0, 1].includes(result.status))
  throw new Error(result.stderr || "Registry audit failed");
const report = JSON.parse(result.stdout);
if (!report.metadata?.vulnerabilities || !report.advisories)
  throw new Error("Invalid audit response");
writeFileSync(process.argv[2] || "security-audit.json", result.stdout, {
  mode: 0o600,
});
const findings = Object.values(report.advisories);
const locallyPatched = findings.filter(
  (finding) =>
    finding.github_advisory_id === "GHSA-gcqx-w48m-w2h4" &&
    finding.module_name === "deepmerge" &&
    finding.findings.every(({ version }) => version === "4.3.1"),
);
const componentAbsent = findings.filter(
  (finding) =>
    finding.github_advisory_id === "GHSA-g3hv-75wg-m249" &&
    finding.module_name === "minimatch" &&
    finding.findings.length &&
    finding.findings.every(({ version }) => version === "3.1.5"),
);
const remaining = findings.filter(
  (finding) =>
    !locallyPatched.includes(finding) && !componentAbsent.includes(finding),
);
console.log(
  `Registry findings: ${findings.length}; locally patched: ${locallyPatched.length}; affected optimizer absent: ${componentAbsent.length}; unpatched: ${remaining.length}`,
);
for (const finding of remaining)
  console.error(`${finding.module_name}: ${finding.title} (${finding.url})`);
const regression = spawnSync(
  process.execPath,
  [
    "--test",
    ...["deepmerge.test.mjs", "legacy-minimatch.test.mjs"].map((name) =>
      fileURLToPath(new URL(name, import.meta.url)),
    ),
  ],
  { stdio: "inherit" },
);
if (locallyPatched.length)
  console.log(
    "Upstream deepmerge 4.3.1 remains flagged; the installed local patch is verified above. The raw finding is retained.",
  );
process.exitCode = remaining.length || regression.status !== 0 ? 1 : 0;
