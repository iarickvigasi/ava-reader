import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(
  new URL("./check-image-audit.mjs", import.meta.url),
);
const patched = {
  VulnerabilityID: "CVE-2026-93753",
  PkgName: "deepmerge",
  InstalledVersion: "4.3.1",
  PkgPath: "node_modules/.pnpm/deepmerge@4.3.1_patch_hash=verified/index.js",
};
function audit(
  t,
  {
    finding = patched,
    marker = true,
    service = "api-migrate",
    graph = "",
    os = "alpine",
  } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "ava-image-audit-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "security-reports"));
  if (marker)
    writeFileSync(
      join(directory, `security-reports/${service}-patch.verified`),
      "",
    );
  writeFileSync(join(directory, "security-reports/caddy-packages.txt"), graph);
  writeFileSync(
    join(directory, "scan.json"),
    JSON.stringify({
      Metadata: { OS: { Family: os } },
      Results: [
        {
          Type: service === "caddy" ? "gobinary" : "node-pkg",
          Packages: [{}],
          Vulnerabilities: [finding],
        },
      ],
    }),
  );
  return spawnSync(process.execPath, [script, service, "scan.json"], {
    cwd: directory,
    encoding: "utf8",
  });
}
test("accepts only the verified exact deepmerge backport", (t) => {
  assert.equal(audit(t).status, 0);
  assert.notEqual(audit(t, { marker: false }).status, 0);
  assert.notEqual(
    audit(t, { finding: { ...patched, PkgPath: "unpatched/index.js" } }).status,
    0,
  );
  assert.notEqual(
    audit(t, { finding: { ...patched, VulnerabilityID: "CVE-new" } }).status,
    0,
  );
  assert.notEqual(audit(t, { service: "api" }).status, 0);
  assert.notEqual(audit(t, { os: "unknown" }).status, 0);
});
test("component absence needs a valid graph without OpenPGP", (t) => {
  const options = {
    service: "caddy",
    finding: {
      VulnerabilityID: "GO-2026-5932",
      PkgName: "golang.org/x/crypto",
    },
  };
  assert.notEqual(audit(t, options).status, 0);
  const graph = "github.com/caddyserver/caddy/v2\n";
  assert.equal(audit(t, { ...options, graph }).status, 0);
  assert.notEqual(
    audit(t, {
      ...options,
      graph: graph + "golang.org/x/crypto/openpgp/packet\n",
    }).status,
    0,
  );
});
