import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment } from "parse5";
import { expect, it } from "vitest";
import { ordinaryReferenceChapter } from "@/features/reader/ordinary-reference-fixture";
import { ReaderBlockView } from "./reader-block-view";
import { ReaderMeasurementContext } from "./reader-measurement-context";
import { attr, nodes, text } from "../pagination/measurement/measurement-markup-fixture";

function table(measurement = false) {
  const block = ordinaryReferenceChapter().blocks.find((b) => b.kind === "table")!;
  if (block.kind !== "table") throw Error("fixture");
  block.captionId = "table-caption";
  block.cells[0].inlines = [{ kind: "text", text: block.cells[0].text, language: "uk" }];
  return parseFragment(renderToStaticMarkup(
    <ReaderMeasurementContext value={measurement}>
      <ReaderBlockView block={block} chapterId="notes" pageHeight={600} />
    </ReaderMeasurementContext>,
  ));
}

it("adds one keyboard scroll target while preserving table semantics and exact cell targets", () => {
  const elements = nodes(table());
  const viewport = elements.find((n) => attr(n, "data-reader-table-scroll") !== undefined)!;
  expect(attr(viewport, "tabindex")).toBe("0");
  expect(attr(viewport, "data-block-id")).toBeUndefined();
  const grid = elements.find((n) => n.tagName === "table")!;
  expect(attr(grid, "aria-describedby")).toBe("reader-notes-table-caption");
  const header = elements.find((n) => n.tagName === "th")!;
  const cell = elements.find((n) => n.tagName === "td")!;
  expect(attr(header, "id")).toBe("reader-notes-header");
  expect(attr(header, "scope")).toBe("col");
  expect(attr(cell, "headers")).toBe("reader-notes-header");
  expect(attr(cell, "data-block-id")).toBe("cell");
  expect(text(cell)).toBe("Cell.");
  expect(elements.some((n) => attr(n, "lang") === "uk")).toBe(true);
  for (const id of ["table", "header", "cell"])
    expect(elements.filter((n) => attr(n, "data-block-id") === id)).toHaveLength(1);
});

it("keeps identical measurement text and markers without live IDs, references or focus targets", () => {
  const visible = table(), measured = table(true);
  expect(text(measured)).toBe(text(visible));
  const elements = nodes(measured);
  expect(elements.some((n) => n.attrs.some((a) =>
    ["id", "href", "headers", "aria-describedby", "tabindex"].includes(a.name),
  ))).toBe(false);
  expect(elements.filter((n) => attr(n, "data-reader-block") === "true")).toHaveLength(3);
});
