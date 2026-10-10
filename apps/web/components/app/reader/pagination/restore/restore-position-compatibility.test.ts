import { expect, it } from "vitest";
import { chapter, fixture } from "./restore-position-test-fixture";

it("keeps a still-landed exact block through delayed font correction", () => {
  const f = fixture();
  f.layout("100", 3, { "p4-graphic0": 1 });
  expect(f.layout("110", 4, { "p4-graphic0": 2 })).toBe(2);
  expect(f.layout("120", 4, { "p4-graphic0": 3 })).toBe(3);
});
it("a new explicit jump resets a released pin and settles its exact offset", () => {
  const f = fixture();
  f.layout("100", 3, { "p4-graphic0": 1 });
  f.page(2, "p4-line7");
  f.input.restoreIntent = {
    kind: "block",
    chapterId: chapter,
    blockId: "new-target",
    textOffset: 7,
    key: "jump:2",
    requestId: 2,
  };
  expect(f.layout("jump", 4, { "new-target": 3 })).toBe(3);
  expect(f.hooks.settle).toHaveBeenLastCalledWith(f.input.restoreIntent, true);
});
it("a new Back restore replaces the retained ordinary passage", () => {
  const f = fixture();
  f.layout("100", 3, { "p4-graphic0": 1 });
  f.page(2, "p4-line7");
  f.layout("90", 2, { "p4-line7": 1 });
  f.input.restoreIntent = {
    kind: "block",
    chapterId: chapter,
    blockId: "origin",
    textOffset: 13,
    key: "back:3",
    requestId: 3,
  };
  expect(f.layout("back", 2, { origin: 0, "p4-line7": 1 })).toBe(0);
  expect(f.hooks.settle).toHaveBeenLastCalledWith(f.input.restoreIntent, true);
});
it("failed geometry keeps the warning and reports failed restoration", () => {
  const f = fixture();
  f.layout("failed", 1, {}, undefined, true);
  expect(f.warnings).toEqual(["failed"]);
  expect(f.hooks.settle).toHaveBeenLastCalledWith(f.input.restoreIntent, false);
});
it("a fresh edge-end intent still follows the chapter end during reflow", () => {
  const f = fixture({
    kind: "edge-end",
    sticky: true,
    chapterId: chapter,
    key: "end",
  });
  expect(f.layout("100", 4, {})).toBe(3);
  expect(f.layout("110", 5, {})).toBe(4);
});
