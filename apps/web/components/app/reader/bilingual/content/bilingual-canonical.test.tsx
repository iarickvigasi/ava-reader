import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { canonicalBilingualFixture } from "@/features/reader/bilingual/content/canonical-test-fixture";
import { BilingualFlowContent } from "./bilingual-flow-content";
import { markupNodes, markupText, attribute } from "./flow-test-fixture";
it("keeps canonical structures, source styling, cell IDs, literal code and note links", () => {
  const { chapter, source } = canonicalBilingualFixture();
  const html = renderToStaticMarkup(
    <BilingualFlowContent
      chapter={chapter}
      blocks={source.blocks}
      unitIndexes={chapter.units.map((_, i) => i)}
      side="source"
      pageHeight={600}
    />,
  );
  expect(markupNodes(html, "table")).toHaveLength(1);
  expect(markupNodes(html, "th").length).toBeGreaterThan(0);
  expect(
    markupNodes(html, "ol").some((n) => attribute(n, "start") === "3"),
  ).toBe(true);
  expect(markupNodes(html, "ul")).toHaveLength(1);
  expect(markupNodes(html, "pre")).toHaveLength(1);
  expect(html).toContain('data-block-id="cell-00"');
  expect(html).toContain("font-style:normal");
  expect(markupText(markupNodes(html, "pre")[0])).toBe(
    chapter.units.find((u) => u.kind === "literal")!.text,
  );
  const translated = renderToStaticMarkup(
    <BilingualFlowContent
      chapter={chapter}
      blocks={source.blocks}
      unitIndexes={chapter.units.map((_, i) => i)}
      side="translation"
      pageHeight={600}
    />,
  );
  expect(markupText(markupNodes(translated, "pre")[0])).toBe(
    markupText(markupNodes(html, "pre")[0]),
  );
  expect(translated).not.toContain('data-reader-block="true"');
});
it("retains table header context and exact column positions when only a body cell is on a page", () => {
  const { chapter, source } = canonicalBilingualFixture();
  const table = source.blocks.find((b) => b.kind === "table")!;
  if (table.kind !== "table") throw Error("fixture");
  const body = table.cells.find((c) => !c.headerAxis)!;
  const index = chapter.units.findIndex((u) => u.blockId === body.id);
  const html = renderToStaticMarkup(
    <BilingualFlowContent
      chapter={chapter}
      blocks={source.blocks}
      unitIndexes={[index]}
      side="source"
      pageHeight={600}
    />,
  );
  expect(markupNodes(html, "td").length + markupNodes(html, "th").length).toBe(
    table.cells.length,
  );
  expect(html).toContain("data-bilingual-header-context");
  expect(
    markupNodes(html, "span").filter((n) =>
      attribute(n, "data-bilingual-unit-id"),
    ),
  ).toHaveLength(1);
});
