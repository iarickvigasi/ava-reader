import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  chmodSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./build-images.sh", import.meta.url));
for (const [services, expected] of [
  [["api"], ["api", "api-migrate"]],
  [["catalog"], ["catalog", "catalog-migrate"]],
  [["web"], ["web"]],
  [["caddy"], ["caddy"]],
  [["postgres"], ["postgres"]],
  [
    ["api", "catalog", "web"],
    ["api", "api-migrate", "catalog", "catalog-migrate", "web"],
  ],
]) {
  test(`builds matching targets for ${services.join(", ")}`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "ava-build-images-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const docker = join(directory, "docker");
    const log = join(directory, "calls");
    writeFileSync(
      docker,
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TASK_LOG"\n[ "${11}" != "$TASK_FAIL" ]\n',
    );
    chmodSync(docker, 0o755);
    const env = {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      TASK_LOG: log,
      TASK_FAIL: "",
    };
    execFileSync("sh", [script, ...services], { env });
    const command =
      "compose -f compose.yaml -f compose.prod.yaml -f compose.security.yaml -f compose.migrations.yaml build";
    assert.deepEqual(
      readFileSync(log, "utf8").trim().split("\n"),
      expected.map((service) => `${command} ${service}`),
    );
    writeFileSync(log, "");
    assert.equal(
      spawnSync("sh", [script, "api", "unknown"], { env }).status,
      2,
    );
    assert.equal(spawnSync("sh", [script], { env }).status, 0);
    assert.equal(readFileSync(log, "utf8"), "");
    assert.equal(
      spawnSync("sh", [script, "api", "catalog", "web"], {
        env: { ...env, TASK_FAIL: "api-migrate" },
      }).status,
      1,
    );
    assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), [
      `${command} api`,
      `${command} api-migrate`,
    ]);
  });
}
