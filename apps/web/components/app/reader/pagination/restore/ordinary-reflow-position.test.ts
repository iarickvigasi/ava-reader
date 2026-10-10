import { expect, it } from "vitest";
import { chapter, fixture } from "./restore-position-test-fixture";

it("cannot resurrect a consumed cold block when reflow recycles its page number", () => {
  const f = fixture();
  f.layout("100", 2, { "p4-graphic0": 1 });
  f.layout("135", 3, { "p4-graphic0": 1, "p4-line7": 2 });
  f.page(2, "p4-line7");
  expect(f.layout("125", 2, { "p4-graphic0": 0, "p4-line7": 1 })).toBe(1);
  expect(f.layout("115", 2, { "p4-graphic0": 0, "p4-line7": 1 })).toBe(1);
});
it("keeps the ordinary anchor across successive earlier page-first publications", () => {
  const f = fixture(null),
    first = ["p3-line1", "p4-line1", "p4-line7"];
  f.layout("135", 3, { "p4-graphic0": 1, "p4-line7": 2 });
  f.page(2, "p4-line7");
  expect(f.layout("125", 2, { "p4-line7": 1 }, first)).toBe(1);
  for (const scale of ["115", "105", "95", "85"])
    expect(f.layout(scale, 2, { "p4-line7": 1, "p4-line1": 0 }, first)).toBe(1);
});
it("does not reacquire a block pin by paging away and back to its old index", () => {
  const f = fixture();
  f.layout("100", 3, { "p4-graphic0": 1 });
  f.page(2, "p4-line7");
  f.page(1, "p4-line1");
  expect(f.layout("110", 3, { "p4-graphic0": 0, "p4-line1": 2 })).toBe(2);
});
it("keeps a departed chapter-edge pin released after a reflow index collision", () => {
  const f = fixture({
    kind: "edge-start",
    sticky: true,
    chapterId: chapter,
    key: "start",
  });
  f.layout("100", 3, {});
  f.page(2, "p4-line7");
  expect(f.layout("90", 2, { "p4-line7": 0 })).toBe(0);
  expect(f.layout("95", 2, { "p4-line7": 1 })).toBe(1);
});
it("an actual user page step releases the retained ordinary reflow anchor", () => {
  const f = fixture(null);
  f.layout("100", 4, { "p4-graphic0": 1 });
  f.page(2, "p4-line7");
  f.layout("110", 4, { "p4-line7": 2 });
  f.page(3, "new-page");
  expect(f.layout("120", 4, { "p4-line7": 1, "new-page": 3 })).toBe(3);
});
