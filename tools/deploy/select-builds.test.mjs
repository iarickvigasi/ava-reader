import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const selector = fileURLToPath(new URL("./select-builds.sh", import.meta.url));
const all = ["api", "catalog", "web", "caddy", "postgres"];

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "ava-select-builds-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  git("init", "-q");
  function commit(path) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), `fixture ${Math.random()}\n`);
    git("add", "--", path);
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
    return git("rev-parse", "HEAD");
  }
  const baseline = commit("README.md");
  const select = (base = baseline) =>
    execFileSync("sh", [selector, base, "HEAD"], {
      cwd: directory,
      encoding: "utf8",
    })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  return { git, commit, select, baseline };
}

for (const [path, services] of [
  ["apps/web/features/example.ts", ["web"]],
  ["apps/api/prisma/example.sql", ["api"]],
  ["apps/catalog/src/importer/example.ts", ["catalog"]],
  ["docs/deployment.md", []],
  ["tools/security/caddy/go.mod", ["caddy"]],
  ["tools/security/postgres.Dockerfile", ["postgres"]],
  ["pnpm-lock.yaml", all],
  ["packages/shared/example.ts", all],
  ["compose.prod.yaml", all],
  [".github/workflows/deploy.yml", all],
]) {
  test(`selects affected services for ${path}`, (t) => {
    const f = fixture(t);
    f.commit(path);
    assert.deepEqual(f.select(), services);
  });
}

test("includes changes from an earlier failed deployment", (t) => {
  const f = fixture(t);
  f.commit("apps/api/src/example.ts");
  f.commit("apps/web/app/example.ts");
  assert.deepEqual(f.select(), ["api", "web"]);
});

test("handles first deploy, invalid baseline, no changes, and deleted files", (t) => {
  const f = fixture(t);
  assert.deepEqual(f.select(""), all);
  assert.deepEqual(f.select("missing-commit"), all);
  assert.deepEqual(f.select(), []);
  const base = f.commit("apps/catalog/src/example.ts");
  f.git("rm", "apps/catalog/src/example.ts");
  f.git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-qm",
    "delete",
  );
  assert.deepEqual(f.select(base), ["catalog"]);
});
