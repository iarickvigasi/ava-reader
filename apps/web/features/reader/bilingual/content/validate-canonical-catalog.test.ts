import { describe, it, expect } from "vitest";
import { canonicalBilingualFixture } from "./canonical-test-fixture";
import { validCanonicalCatalog } from "./validate-canonical-catalog";
describe("accepted canonical translation source", () => {
  it("accepts exact ordered leaves including cells, nested items, images and literal code", () => {
    const { chapter, source } = canonicalBilingualFixture();
    expect(
      validCanonicalCatalog(chapter, source.blocks, chapter.contentRevision),
    ).toBe(true);
  });
  it.each([
    "revision",
    "text",
    "missing",
    "reorder",
    "offset",
    "foreign",
    "literal",
  ] as const)("rejects %s corruption before display or generation", (fault) => {
    const { chapter, source } = canonicalBilingualFixture();
    if (fault === "revision") chapter.contentRevision = "wrong";
    if (fault === "text") chapter.units[0].text += "bad";
    if (fault === "missing") chapter.units.splice(1, 1);
    if (fault === "reorder") chapter.units.reverse();
    if (fault === "offset") chapter.units[1].startOffset++;
    if (fault === "foreign") chapter.units[0].blockId = "foreign";
    if (fault === "literal")
      chapter.units.find((u) => u.kind === "literal")!.kind = "sentence";
    expect(
      validCanonicalCatalog(
        chapter,
        source.blocks,
        canonicalBilingualFixture().chapter.contentRevision,
      ),
    ).toBe(false);
  });
});
