import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import { ordinaryReferenceChapter } from "@/features/reader/ordinary-reference-fixture";
import { ReaderBlockView } from "./reader-block-view";
import { ReaderMeasurementContext } from "./reader-measurement-context";

type Node = DefaultTreeAdapterMap["node"];
function elements(node: Node): DefaultTreeAdapterMap["element"][] {
  return [
    ...("tagName" in node ? [node] : []),
    ...("childNodes" in node ? node.childNodes.flatMap(elements) : []),
  ];
}
function text(node: Node): string {
  return "value" in node
    ? node.value
    : "childNodes" in node
      ? node.childNodes.map(text).join("")
      : "";
}
function markup(measurement = false) {
  return renderToStaticMarkup(
    <ReaderMeasurementContext value={measurement}>
      {ordinaryReferenceChapter().blocks.map((block) => (
        <ReaderBlockView
          key={block.id}
          block={block}
          chapterId="notes"
          pageHeight={700}
        />
      ))}
    </ReaderMeasurementContext>,
  );
}
describe("ordinary reference DOM", () => {
  it("exposes exact nested item and cell text at their own navigation markers", () => {
    const nodes = elements(parseFragment(markup()));
    for (const [id, expected] of [
      ["outer", "Outer."],
      ["nested", "Nested 😀."],
      ["last", "Last."],
      ["cell", "Cell."],
    ]) {
      const node = nodes.find((node) =>
        node.attrs.some(
          (attr) => attr.name === "data-block-id" && attr.value === id,
        ),
      );
      expect(node?.attrs).toContainEqual({
        name: "data-reader-block",
        value: "true",
      });
      expect(node?.attrs).toContainEqual({
        name: "data-chapter-id",
        value: "notes",
      });
      expect(node && text(node)).toBe(expected);
    }
    expect(markup()).toContain('start="3"');
    const header = nodes.find((node) =>
      node.attrs.some(
        (attr) => attr.name === "data-block-id" && attr.value === "header",
      ),
    );
    const cell = nodes.find((node) =>
      node.attrs.some(
        (attr) => attr.name === "data-block-id" && attr.value === "cell",
      ),
    );
    expect(header?.attrs).toContainEqual({
      name: "id",
      value: "reader-notes-header",
    });
    expect(cell?.attrs).toContainEqual({
      name: "headers",
      value: "reader-notes-header",
    });
  });
  it("keeps measurement markers while stripping live IDs and focus targets", () => {
    const html = markup(true);
    expect(html).toContain('data-block-id="nested"');
    expect(html).not.toMatch(/(?:^| )id=/);
    expect(html).not.toContain("tabindex=");
  });
});
