import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./run-ssh.sh", import.meta.url));
for (const status of [0, 23]) {
  test(`pins the host, isolates credentials and cleans up after SSH exit ${status}`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "ava-ssh-test-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const record = join(directory, "record");
    writeFileSync(join(directory, "timeout"), '#!/bin/sh\nshift\nexec "$@"\n', {
      mode: 0o755,
    });
    writeFileSync(
      join(directory, "ssh"),
      `#!/usr/bin/env node
const fs = require('node:fs'), assert = require('node:assert/strict');
const args = process.argv.slice(2), key = args[args.indexOf('-i') + 1];
assert.equal(process.env.SSH_PRIVATE_KEY, undefined);
assert.equal(fs.statSync(key).mode & 511, 384);
assert.equal(fs.readFileSync(key, 'utf8'), 'test-key\\n');
fs.writeFileSync(process.env.TASK_RECORD, JSON.stringify({args,key}));
process.exit(Number(process.env.TASK_STATUS));
`,
      { mode: 0o755 },
    );
    const result = spawnSync("sh", [script], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        RUNNER_TEMP: directory,
        SSH_HOST: "example.invalid",
        SSH_USER: "deploy",
        SSH_PRIVATE_KEY: "test-key",
        TASK_RECORD: record,
        TASK_STATUS: String(status),
      },
      encoding: "utf8",
    });
    assert.equal(result.status, status, result.stderr);
    const { args, key } = JSON.parse(readFileSync(record, "utf8"));
    for (const policy of [
      "StrictHostKeyChecking=yes",
      "HostKeyAlias=ava-production",
      "HostKeyAlgorithms=ssh-ed25519",
      "PasswordAuthentication=no",
    ])
      assert.ok(args.includes(policy));
    assert.equal(existsSync(key), false);
  });
}
