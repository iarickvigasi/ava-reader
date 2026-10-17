import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReaderListBlock } from "@/lib/api-types/reader-content";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { canonicalChapters } from "@/features/reader/canonical/chapters";
import { ReaderStructuredList } from "./reader-structured-list";
import { listMarkerProps } from "./list-marker-style";
import { BilingualFlowContent } from "../bilingual/content/bilingual-flow-content";
import { ordinaryNestedBilingualFixture } from "@/features/reader/bilingual/content/ordinary-nested-test-fixture";
import {
  attribute,
  flowBlocks,
  flowChapter,
  markupNodes,
} from "../bilingual/content/flow-test-fixture";

const marker = {
  id: "source-marker",
  color: "#1f3763",
  family: "sans-serif" as const,
  bold: false,
  italic: false,
  relative_size: 0.8,
};

describe("source list marker presentation", () => {
  it("projects its own style reference without changing body text or locators", () => {
    const book = structuredClone(canonicalFixture().readerPackage!.book);
    const node = book.blocks.find((b) => b.kind === "list_item")!;
    if (node.kind !== "list_item") throw Error("Missing list");
    const body = JSON.stringify(node.content);
    node.marker_style_id = marker.id;
    book.styles.push(marker);
    const chapters = canonicalChapters(book, { "image-one": "fixture.png" });
    const list = chapters
      .flatMap((c) => c.blocks)
      .find((b) => b.kind === "list") as ReaderListBlock;
    expect(list.items[0].markerPresentation).toEqual(marker);
    expect(JSON.stringify(list.items[0].canonicalText)).toBe(body);
    expect(list.items[0].presentation?.color).not.toBe(marker.color);
  });

  it("styles only the marker and leaves an unstyled nested marker independent", () => {
    const list = canonicalFixture().chapters[0].blocks.find(
      (b) => b.kind === "list",
    ) as ReaderListBlock;
    list.items[0].markerPresentation = marker;
    list.items[0].presentation = { id: "body", bold: true, italic: true };
    const html = renderToStaticMarkup(
      <ReaderStructuredList block={list} chapterId="chapter-one" />,
    );
    const items = markupNodes(html, "li");
    expect(attribute(items[0], "style")).toContain(
      "--reader-marker-color:light-dark(#1f3763, #aaafb8)",
    );
    expect(attribute(items[0], "style")).toContain(
      "--reader-marker-weight:400",
    );
    expect(attribute(items[0], "style")).toContain(
      "--reader-marker-style:normal",
    );
    expect(attribute(items[0], "style")).toContain("font-weight:700");
    expect(attribute(items[0], "style")).not.toContain(";color:#1f3763");
    expect(attribute(items[1], "class")).toBeUndefined();
    expect(attribute(items[1], "style") ?? "").not.toContain("--reader-marker");
    expect(html).toContain('start="3"');
  });

  it.each(["source", "translation"] as const)(
    "preserves markers and ordinals in nested bilingual %s flow",
    (side) => {
      const { source, chapter, list } = ordinaryNestedBilingualFixture();
      list.items[0].markerPresentation = marker;
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
      expect(attribute(items[0], "style")).toContain(
        "--reader-marker-color:light-dark(#1f3763, #aaafb8)",
      );
      expect(items.map((item) => attribute(item, "value"))).toEqual([
        "3",
        "2",
        "4",
      ]);
      expect(attribute(items[1], "class")).toBeUndefined();
    },
  );

  it("resets unknown child marker variables and projects neutral black with other source colors", () => {
    const list = canonicalFixture().chapters[0].blocks.find(
      (b) => b.kind === "list",
    ) as ReaderListBlock;
    const item = {
      ...list.items[0],
      markerPresentation: { id: "child", bold: false },
    };
    expect(listMarkerProps(item).style).toMatchObject({
      "--reader-marker-color": "initial",
      "--reader-marker-family": "initial",
      "--reader-marker-style": "initial",
      "--reader-marker-weight": 400,
    });
    expect(
      listMarkerProps({
        ...item,
        markerPresentation: { id: "neutral", color: "#000000" },
      }).style,
    ).toHaveProperty("--reader-marker-color", "light-dark(#000000, #b2aea8)");
  });
  it.each(["source", "translation"] as const)(
    "retains styled markers and continuation numbering in flat bilingual %s flow",
    (side) => {
      const blocks = structuredClone(flowBlocks);
      const list = blocks.find(
        (block) => block.kind === "list",
      ) as ReaderListBlock;
      list.items[0].markerPresentation = marker;
      const html = renderToStaticMarkup(
        <BilingualFlowContent
          chapter={flowChapter}
          blocks={blocks}
          unitIndexes={[4, 5]}
          side={side}
          pageHeight={600}
        />,
      );
      const items = markupNodes(html, "li");
      expect(attribute(items[0], "style")).toContain(
        "--reader-marker-color:light-dark(#1f3763, #aaafb8)",
      );
      expect(attribute(items[0], "style")).toContain("list-style-type:none");
      expect(items.map((item) => attribute(item, "value"))).toEqual(["1", "2"]);
      expect(attribute(items[1], "class")).toBeUndefined();
    },
  );
});
