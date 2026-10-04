import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import type { ReaderBlock } from "@/lib/api-types";
import { ReaderBlockView } from "./reader-block-view";
import { ReaderMeasurementContext } from "./reader-measurement-context";

type Node = DefaultTreeAdapterMap["node"];
function nodes(node: Node): DefaultTreeAdapterMap["element"][] {
  return [
    ...("tagName" in node ? [node] : []),
    ...("childNodes" in node ? node.childNodes.flatMap(nodes) : []),
  ];
}
function fixture(kind: "list" | "table"): ReaderBlock {
  const leaf = {
    id: "leaf",
    text: "Small regular centered",
    fontWeight: 400,
    fontSizeScale: 0.5,
    align: "center" as const,
    textIndent: 0,
    inlines: [{ kind: "text" as const, text: "Small regular centered" }],
  };
  const base = {
    id: "parent",
    text: "Small regular centered",
    fontWeight: 700,
    fontSizeScale: 2,
    align: "right" as const,
  };
  return kind === "list"
    ? { ...base, kind, ordered: true, items: [leaf] }
    : { ...base, kind, cells: [{ ...leaf, row: 0, column: 0, headerIds: [] }] };
}
describe("ordinary list and table leaf typography", () => {
  it.each(["list", "table"] as const)(
    "applies own %s scalar styles at its actual leaf, including hidden measurement",
    (kind) => {
      for (const measurement of [false, true]) {
        const markup = renderToStaticMarkup(
          <ReaderMeasurementContext value={measurement}>
            <ReaderBlockView
              block={fixture(kind)}
              chapterId="body"
              pageHeight={600}
            />
          </ReaderMeasurementContext>,
        );
        const elements = nodes(parseFragment(markup));
        const leaf = elements.find(
          (node) => node.tagName === (kind === "list" ? "li" : "td"),
        );
        const style = leaf?.attrs.find((attr) => attr.name === "style")?.value;
        expect(style).toContain("font-weight:400");
        expect(style).toContain("--reader-block-scale:0.5");
        expect(style).toContain("font-size:calc(");
        expect(style).toContain(`--reader-${kind}-base`);
        expect(style).toContain("text-align:center");
        expect(style).toContain("text-indent:0em");
        expect(
          leaf?.attrs.find((attr) => attr.name === "class")?.value ?? "",
        ).not.toContain("text-start");
        const parent = elements.find(
          (node) => node.tagName === (kind === "list" ? "ol" : "table"),
        );
        expect(
          parent?.attrs.find((attr) => attr.name === "style")?.value,
        ).toContain("font-weight:700");
      }
    },
  );
});
