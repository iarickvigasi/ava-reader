import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReaderListBlock } from "@/lib/api-types/reader-content";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { ReaderStructuredList } from "./reader-structured-list";
import { listBodyStyle } from "./list-body-style";
import { attribute, markupNodes } from "../bilingual/content/flow-test-fixture";
import { BilingualFlowContent } from "../bilingual/content/bilingual-flow-content";
import { ordinaryNestedBilingualFixture } from "@/features/reader/bilingual/content/ordinary-nested-test-fixture";

describe("semantic list body geometry", () => {
  it.each([
    [-2, 0, "2em"],
    [-2, 0.5, "1.5em"],
    [-2, 2, undefined],
    [0, 0, undefined],
    [1, 0, undefined],
    [undefined, undefined, undefined],
  ] as const)(
    "keeps relative body indent %s/inset %s inside the marker gutter",
    (indent, inset, padding) => {
      const item = {
        id: "body",
        text: "Authored body",
        presentation: {
          id: "declared",
          indent_em: indent,
          block_indent_em: inset,
        },
      };
      const before = JSON.stringify(item);
      const layout = listBodyStyle(item);
      expect(layout.item.textIndent).toBe("0em");
      expect(layout.body.paddingInlineStart).toBe(padding);
      expect(layout.body.textIndent).toBe(
        indent === undefined ? undefined : `${indent}em`,
      );
      expect(layout.body.marginInlineStart).toBe(
        inset === undefined ? undefined : `${inset}em`,
      );
      expect(JSON.stringify(item)).toBe(before);
    },
  );
  it("separates a legacy marker hang from the marker without changing its data", () => {
    const list = canonicalFixture().chapters[0].blocks.find(
      (b) => b.kind === "list",
    ) as ReaderListBlock;
    list.items[0].presentation = {
      id: "legacy-body",
      indent_em: -1.384,
      block_indent_em: 2.766,
      bold: true,
    };
    list.items[0].markerPresentation = {
      id: "blue-number",
      color: "#1f3763",
      family: "sans-serif",
      bold: false,
    };
    const before = JSON.stringify(list);
    const html = renderToStaticMarkup(
      <ReaderStructuredList block={list} chapterId="chapter-one" />,
    );
    const item = markupNodes(html, "li")[0];
    expect(attribute(item, "style")).toContain("text-indent:0em");
    expect(attribute(item, "style")).not.toContain("text-indent:-");
    expect(attribute(item, "style")).not.toContain("margin-inline-start");
    expect(attribute(item, "style")).toContain(
      "--reader-marker-color:light-dark(#1f3763, #aaafb8)",
    );
    expect(attribute(item, "style")).toContain("font-weight:700");
    const body = markupNodes(html, "span").find(
      (node) => attribute(node, "data-reader-block-kind") === "paragraph",
    )!;
    expect(attribute(body, "style")).toContain("text-indent:-1.384em");
    expect(attribute(body, "style")).toContain("margin-inline-start:2.766em");
    expect(attribute(body, "style")).toContain("display:block");
    expect(html).toContain('start="3"');
    expect(JSON.stringify(list)).toBe(before);
  });
  it.each(["source", "translation"] as const)(
    "preserves body-only hanging geometry and nesting in bilingual %s",
    (side) => {
      const { source, chapter, list } = ordinaryNestedBilingualFixture();
      list.items[0].textIndent = -0.75;
      const before = JSON.stringify(list);
      const html = renderToStaticMarkup(
        <BilingualFlowContent
          chapter={chapter}
          blocks={source.blocks}
          unitIndexes={[0, 1, 2]}
          side={side}
          pageHeight={600}
        />,
      );
      const items = markupNodes(html, "li");
      expect(attribute(items[0], "style")).toContain("text-indent:0em");
      expect(attribute(items[0], "style")).not.toContain("text-indent:-");
      expect(
        markupNodes(html, "div").some((node) =>
          attribute(node, "style")?.includes("text-indent:-0.75em"),
        ),
      ).toBe(true);
      expect(items.map((node) => attribute(node, "value"))).toEqual([
        "3",
        "2",
        "4",
      ]);
      expect(JSON.stringify(list)).toBe(before);
    },
  );
});
