import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

let require = createRequire(
  process.env.AVA_DEEPMERGE_PACKAGE ||
    new URL("../../apps/api/package.json", import.meta.url),
);
for (const dependency of ["eslint", "@eslint/eslintrc"])
  require = createRequire(require.resolve(dependency));
const entry = require.resolve("minimatch");
const minimatch = require(entry);

test("legacy minimatch 3 does not contain the affected optimization pipeline", () => {
  assert.equal(require("minimatch/package.json").version, "3.1.5");
  const source = readFileSync(entry, "utf8");
  assert.equal(source.includes("firstPhasePreProcess"), false);
  assert.equal(source.includes("optimizationLevel"), false);
  const matcher = new minimatch.Minimatch("a/" + "**/../".repeat(64) + "b", {
    optimizationLevel: 2,
  });
  assert.equal(matcher.firstPhasePreProcess, undefined);
  assert.equal(matcher.globParts.length, 1);
  assert.equal(minimatch("src/example.ts", "src/**/*.ts"), true);
});
