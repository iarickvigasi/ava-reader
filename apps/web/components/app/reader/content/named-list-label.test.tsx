import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { canonicalChapters } from "@/features/reader/canonical/chapters";
import { ReaderStructuredList } from "./reader-structured-list";
import { BilingualFlowContent } from "../bilingual/content/bilingual-flow-content";
import {
  attribute,
  markupNodes,
  markupText,
} from "../bilingual/content/flow-test-fixture";

it("keeps unordered literal labels counter-free in ordinary and bilingual readers", () => {
  const book = structuredClone(canonicalFixture().readerPackage!.book);
  const group = book.lists.find((list) => list.ordered)!;
  Object.assign(group, { ordered: false, start: null, marker_style: "none" });
  group.item_ids.forEach((id, index) => {
    const item = book.blocks.find((b) => b.id === id);
    if (item?.kind !== "list_item") throw Error("Missing named item");
    item.content.text = `${index === 0 ? "Q2" : "Q1"} Authored label.`;
    item.content.spans = [];
  });
  const blocks = canonicalChapters(book, { "image-one": "fixture.png" })[0]
    .blocks;
  const list = blocks.find((block) => block.kind === "list");
  if (list?.kind !== "list") throw Error("Missing canonical named list");
  const before = JSON.stringify(list.items.map((item) => item.canonicalText));
  const units = list.items.map((item) => ({
    id: `named-${item.id}`,
    blockId: item.id,
    text: item.text,
    startOffset: 0,
    endOffset: item.text.length,
    kind: "sentence" as const,
  }));
  const chapter: BilingualChapter = {
    libraryItemId: "named-fixture",
    chapterId: "chapter-one",
    contentRevision: "named-revision",
    translationVersion: 1,
    targetLang: "fr",
    units,
    translations: Object.fromEntries(
      units.map((unit) => [unit.id, `FR ${unit.text}`]),
    ),
  };
  const htmls = [
    renderToStaticMarkup(
      <ReaderStructuredList block={list} chapterId="chapter-one" />,
    ),
    ...(["source", "translation"] as const).map((side) =>
      renderToStaticMarkup(
        <BilingualFlowContent
          chapter={chapter}
          blocks={blocks}
          unitIndexes={units.map((_, i) => i)}
          side={side}
          pageHeight={600}
        />,
      ),
    ),
  ];
  htmls.forEach((html, index) => {
    const literal = markupNodes(html, "ul").find((n) =>
      attribute(n, "style")?.includes("list-style-type:none"),
    );
    expect(literal).toBeDefined();
    expect(attribute(literal!, "start")).toBeUndefined();
    expect(html).not.toMatch(/<ol\b/);
    expect(
      markupNodes(html, "li").every((n) => attribute(n, "value") === undefined),
    ).toBe(true);
    const text = markupText(literal!);
    expect(text).toContain(`${index === 2 ? "FR " : ""}Q2 Authored label.`);
    expect(text).toContain(`${index === 2 ? "FR " : ""}Q1 Authored label.`);
    expect(text.indexOf("Q2")).toBeLessThan(text.indexOf("Q1"));
  });
  expect(JSON.stringify(list.items.map((item) => item.canonicalText))).toBe(
    before,
  );
});
