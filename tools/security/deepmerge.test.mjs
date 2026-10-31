import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

let require = createRequire(
  process.env.AVA_DEEPMERGE_PACKAGE ||
    new URL("../../apps/api/package.json", import.meta.url),
);
for (const dependency of ["jest", "@jest/core", "jest-config"]) {
  require = createRequire(require.resolve(dependency));
}
const main = require.resolve("deepmerge");
const payload = JSON.parse('{"__proto__":{"polluted":true}}');
for (const [entry, merge] of [
  ["cjs", require(main)],
  ["umd", require(join(dirname(main), "umd.js"))],
]) {
  for (const [targetName, target] of [
    ["ordinary", {}],
    ["null", null],
    ["no prototype", Object.create(null)],
    ["poisoned", payload],
  ]) {
    for (const [sourceName, source] of [
      ["empty", {}],
      ["poisoned", payload],
    ]) {
      test(`${entry}: ${targetName} target and ${sourceName} source cannot poison the result`, () => {
        const result = merge(target, source);
        assert.equal(Object.getPrototypeOf(result), Object.prototype);
        assert.equal(result.polluted, undefined);
        assert.equal({}.polluted, undefined);
        assert.equal(Object.hasOwn(result, "__proto__"), false);
      });
    }
  }
  test(`${entry}: unsafe nested keys are rejected and ordinary merges still work`, () => {
    const malicious = JSON.parse(
      '{"constructor":{"prototype":{"polluted":true}}}',
    );
    const result = merge(
      { nested: { values: [1] } },
      { nested: { ...malicious, values: [2] } },
    );
    assert.deepEqual(result, { nested: { values: [1, 2] } });
    assert.equal(Object.hasOwn(result.nested, "constructor"), false);
    assert.equal({}.polluted, undefined);
  });
}
