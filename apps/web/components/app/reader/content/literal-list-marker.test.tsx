import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { canonicalChapters } from "@/features/reader/canonical/chapters";
import { BilingualFlowContent } from "../bilingual/content/bilingual-flow-content";
import {
  attribute,
  markupNodes,
  markupText,
} from "../bilingual/content/flow-test-fixture";

it.each([
  { side: "source" as const, splitLabel: false, continued: false },
  { side: "translation" as const, splitLabel: false, continued: false },
  { side: "source" as const, splitLabel: true, continued: false },
  { side: "source" as const, splitLabel: true, continued: true },
])(
  "keeps literal text in bilingual $side split=$splitLabel continued=$continued",
  ({ side, splitLabel, continued }) => {
    const book = structuredClone(canonicalFixture().readerPackage!.book);
    const sourceList = book.lists.find((list) => list.ordered)!;
    sourceList.marker_style = "none";
    const labelled = book.blocks.find((b) => b.id === sourceList.item_ids[0]);
    if (labelled?.kind !== "list_item") throw Error("Missing literal item");
    labelled.literal_label = { prefix_end: 6, column_em: 4.2 };
    const blocks = canonicalChapters(book, { "image-one": "fixture.png" })[0]
      .blocks;
    const list = blocks.find((block) => block.kind === "list");
    if (list?.kind !== "list") throw Error("Missing canonical list");
    const before = JSON.stringify(list.items.map((item) => item.canonicalText));
    const units = list.items.map((item) => ({
      id: `literal-${item.id}`,
      blockId: item.id,
      text: item.text,
      startOffset: 0,
      endOffset: item.text.length,
      kind: "sentence" as const,
    }));
    if (splitLabel) {
      const first = units[0];
      units.splice(
        0,
        1,
        {
          ...first,
          id: `${first.id}-prefix`,
          text: first.text.slice(0, 5),
          endOffset: 5,
        },
        {
          ...first,
          id: `${first.id}-body`,
          text: first.text.slice(6),
          startOffset: 6,
        },
      );
    }
    const selected = units
      .map((_, index) => index)
      .filter((index) => !continued || index > 0);
    const chapter: BilingualChapter = {
      libraryItemId: "literal-fixture",
      chapterId: "chapter-one",
      contentRevision: "literal-revision",
      translationVersion: 1,
      targetLang: "fr",
      units,
      translations: Object.fromEntries(
        units.map((unit) => [unit.id, `FR ${unit.text}`]),
      ),
    };
    const html = renderToStaticMarkup(
      <BilingualFlowContent
        chapter={chapter}
        blocks={blocks}
        unitIndexes={selected}
        side={side}
        pageHeight={600}
      />,
    );
    const lists = markupNodes(html, "ol");
    expect(attribute(lists[0], "style")).toContain("list-style-type:none");
    const labels = markupNodes(html, "span").filter(
      (n) => attribute(n, "data-reader-literal-label") !== undefined,
    );
    expect(labels).toHaveLength(side === "source" && !splitLabel ? 1 : 0);
    if (side === "source" && !splitLabel)
      expect(markupText(labels[0])).toBe("First ");
    if (splitLabel) expect(html).not.toContain("padding-inline-start:4.2em");
    const items = markupNodes(html, "li");
    expect(items).toHaveLength(list.items.length);
    items.forEach((item, index) => {
      expect(markupText(item)).toBe(
        `${side === "translation" ? "FR " : ""}${continued && index === 0 ? list.items[index].text.slice(6) : list.items[index].text}`,
      );
      expect(attribute(item, "data-bilingual-flow-item")).toBe(
        list.items[index].id,
      );
      expect(attribute(item, "data-bilingual-flow-item-start")).toBe("0");
    });
    expect(JSON.stringify(list.items.map((item) => item.canonicalText))).toBe(
      before,
    );
  },
);
