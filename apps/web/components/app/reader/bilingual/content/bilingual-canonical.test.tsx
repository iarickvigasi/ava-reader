import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { canonicalBilingualFixture } from "@/features/reader/bilingual/content/canonical-test-fixture";
import { BilingualMeasurements } from "../measurement/bilingual-measurements";
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

it("retains merged cells and empty rows covered by vertical spans", () => {
  const { chapter, source } = canonicalBilingualFixture();
  const table = source.blocks.find((b) => b.kind === "table")!;
  if (table.kind !== "table") throw Error("fixture");
  table.cells = [
    { ...table.cells[0], columnSpan: 2, rowSpan: 2, headerIds: [] },
  ];
  const html = renderToStaticMarkup(
    <BilingualFlowContent
      chapter={chapter}
      blocks={source.blocks}
      unitIndexes={chapter.units.map((_, i) => i)}
      side="source"
      pageHeight={600}
    />,
  );
  expect(markupNodes(html, "tr")).toHaveLength(2);
  expect(markupNodes(html, "th")).toHaveLength(1);
  expect(attribute(markupNodes(html, "th")[0], "colspan")).toBe("2");
  expect(attribute(markupNodes(html, "th")[0], "rowspan")).toBe("2");
});

it("keeps hidden bilingual table templates noninteractive without changing source cell text", () => {
  const { chapter, source } = canonicalBilingualFixture();
  const html = renderToStaticMarkup(
    <BilingualMeasurements chapter={chapter} blocks={source.blocks}
      size={{ width: 330, height: 600 }} measurementRef={{ current: null }} />,
  );
  const tables = markupNodes(html, "table");
  expect(tables).toHaveLength(2);
  for (const element of [...markupNodes(html, "th"), ...markupNodes(html, "td")]) {
    expect(attribute(element, "id")).toBeUndefined();
    expect(attribute(element, "headers")).toBeUndefined();
  }
  for (const viewport of markupNodes(html, "div").filter((n) =>
    attribute(n, "data-reader-table-scroll") !== undefined,
  )) expect(attribute(viewport, "tabindex")).toBeUndefined();
  const expected = source.blocks.find((block) => block.kind === "table")!;
  if (expected.kind !== "table") throw Error("fixture");
  for (const cell of expected.cells) expect(markupText(tables[0])).toContain(cell.text);
});
