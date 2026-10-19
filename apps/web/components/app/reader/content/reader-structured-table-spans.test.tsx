import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { canonicalBilingualFixture } from "@/features/reader/bilingual/content/canonical-test-fixture";
import { ReaderStructuredTable } from "./reader-structured-table";

it("keeps one selectable merged header and a fully spanned empty row", () => {
  const { source } = canonicalBilingualFixture();
  const table = source.blocks.find((block) => block.kind === "table")!;
  if (table.kind !== "table") throw Error("fixture");
  table.cells = [
    { ...table.cells[0], columnSpan: 2, rowSpan: 2, headerIds: [] },
  ];
  const html = renderToStaticMarkup(
    <ReaderStructuredTable block={table} chapterId={source.chapterId} />,
  );
  expect(html.match(/<tr>/g)).toHaveLength(2);
  expect(html.match(/<th /g)).toHaveLength(1);
  expect(html).toContain('colSpan="2"');
  expect(html).toContain('rowSpan="2"');
  expect(html).toContain(table.cells[0].text);
});
