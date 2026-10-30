import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workflow = readFileSync(
  new URL("../../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);
const checkout = workflow
  .match(
    /            if ! git diff --quiet[\s\S]*?            git pull --ff-only origin main/,
  )[0]
  .replace(/^ {12}/gm, "");
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ava-checkout-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = join(root, "remote"),
    server = join(root, "server"),
    writer = join(root, "writer");
  const git = (cwd, ...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git(root, "init", "--bare", "--initial-branch=main", remote);
  git(root, "clone", remote, writer);
  const commit = (cwd, text) => {
    writeFileSync(join(cwd, "tracked"), text);
    git(cwd, "add", "tracked");
    git(
      cwd,
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      text,
    );
  };
  commit(writer, "initial");
  git(writer, "push", "origin", "main");
  git(root, "clone", remote, server);
  const update = () => {
    commit(writer, "remote update");
    git(writer, "push", "origin", "main");
  };
  const run = () =>
    spawnSync("sh", ["-ec", checkout], { cwd: server, encoding: "utf8" });
  return { git, server, writer, commit, update, run };
}

test("fast-forwards a clean checkout while retaining server-local files", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.server, ".env"), "fixture-only");
  f.update();
  assert.equal(f.run().status, 0);
  assert.equal(
    f.git(f.server, "rev-parse", "HEAD"),
    f.git(f.writer, "rev-parse", "HEAD"),
  );
  assert.equal(readFileSync(join(f.server, ".env"), "utf8"), "fixture-only");
});

test("rejects tracked server edits without overwriting them", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.server, "tracked"), "server edit");
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production checkout has tracked edits/);
  assert.equal(readFileSync(join(f.server, "tracked"), "utf8"), "server edit");
});

test("rejects divergent commits without merging or discarding the local commit", (t) => {
  const f = fixture(t);
  f.commit(f.server, "server-only fix");
  const before = f.git(f.server, "rev-parse", "HEAD");
  f.update();
  assert.notEqual(f.run().status, 0);
  assert.equal(f.git(f.server, "rev-parse", "HEAD"), before);
});
