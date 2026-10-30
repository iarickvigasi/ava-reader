import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

const prepare = fileURLToPath(new URL("./prepare-builder.sh", import.meta.url));
const build = fileURLToPath(new URL("./build-images.sh", import.meta.url));
for (const exists of [false, true]) {
  test(`bounded builder is ${exists ? "reused" : "created"} and applied to every image`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "ava-bounded-builder-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const log = join(directory, "calls");
    const docker = join(directory, "docker");
    writeFileSync(
      docker,
      `#!/bin/sh
printf '%s\\n' "$*" >> "$TASK_LOG"
if [ "$*" = 'buildx inspect test-builder' ]; then exit "$TASK_INSPECT"; fi
case "$*" in *'build catalog '*) exit 7 ;; esac
`,
    );
    chmodSync(docker, 0o755);
    const env = {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      TASK_LOG: log,
      TASK_INSPECT: exists ? "0" : "1",
      AVA_DEPLOY_BUILDER: "test-builder",
    };
    assert.equal(spawnSync("sh", [prepare, "test-builder"], { env }).status, 0);
    const preparation = readFileSync(log, "utf8").trim().split("\n");
    assert.deepEqual(preparation, [
      "buildx inspect test-builder",
      ...(!exists
        ? [
            "buildx create --name test-builder --driver docker-container --driver-opt memory=2560m,memory-swap=2560m,cpu-period=100000,cpu-quota=150000,default-load=true",
          ]
        : []),
      "buildx inspect test-builder --bootstrap",
    ]);
    writeFileSync(log, "");
    assert.equal(
      spawnSync("sh", [build, "api", "catalog", "web"], { env }).status,
      7,
    );
    const command =
      "compose -f compose.yaml -f compose.prod.yaml -f compose.migrations.yaml build";
    assert.deepEqual(
      readFileSync(log, "utf8").trim().split("\n"),
      ["api", "api-migrate", "catalog"].map(
        (service) => `${command} ${service} --builder test-builder`,
      ),
    );
  });
}
