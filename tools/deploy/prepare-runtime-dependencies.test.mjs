import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("./prepare-runtime-dependencies.mjs", import.meta.url),
);
for (const service of ["api", "catalog"]) {
  test(`prepares ${service} without deleting other optional dependencies`, (t) => {
    const root = mkdtempSync(join(tmpdir(), "ava-runtime-deps-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const target = join(root, "production");
    const store = join(target, "node_modules/.pnpm");
    for (const name of [
      "prisma@7.8.0",
      "typescript@5.9.3",
      "pg-native@1.0.0",
    ]) {
      mkdirSync(join(store, name), { recursive: true });
    }
    if (service === "api") {
      mkdirSync(join(root, "apps/api"), { recursive: true });
      writeFileSync(join(root, "apps/api/package.json"), "{}");
      const source = join(root, "node_modules");
      mkdirSync(join(source, "@prisma/client"), { recursive: true });
      writeFileSync(join(source, "@prisma/client/package.json"), "{}");
      mkdirSync(join(source, ".prisma/client"), { recursive: true });
      writeFileSync(
        join(source, ".prisma/client/default.js"),
        "generated-client",
      );
      // Mirrors pnpm peer links: optional CLI links may remain dangling after removal.
      symlinkSync(join(store, "prisma@7.8.0"), join(store, "prisma"));
    }
    execFileSync(process.execPath, [script, service, target], { cwd: root });
    assert.equal(existsSync(join(store, "prisma@7.8.0")), false);
    assert.equal(existsSync(join(store, "typescript@5.9.3")), false);
    assert.equal(existsSync(join(store, "pg-native@1.0.0")), true);
    if (service === "api") {
      assert.equal(
        readFileSync(
          join(target, "node_modules/.prisma/client/default.js"),
          "utf8",
        ),
        "generated-client",
      );
    }
  });
}
