import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ordinaryNestedBilingualFixture } from "@/features/reader/bilingual/content/ordinary-nested-test-fixture";
import { flowBlockIndex } from "@/features/reader/bilingual/content/flow-block-index";
import { groupFlowContent } from "@/features/reader/bilingual/content/group-flow-content";
import { sourceInlinesForUnit } from "@/features/reader/bilingual/content/source-inlines";
import { resolveJumpTarget } from "@/features/reader/jump-target";
import { BilingualFlowContent } from "./bilingual-flow-content";
import { attribute, markupNodes, markupText } from "./flow-test-fixture";

describe("ordinary nested-list bilingual consumer", () => {
  it("maps every local item unit to one enclosing source layout and exact source inlines", () => {
    const { source, chapter, list, child } = ordinaryNestedBilingualFixture();
    const original = JSON.stringify(source),
      index = flowBlockIndex(source.blocks);
    for (const unit of chapter.units) {
      expect(index.get(unit.blockId)?.id).toBe(list.id);
      expect(
        resolveJumpTarget(source, {
          blockId: unit.blockId,
          textOffset: unit.endOffset,
        }),
      ).toMatchObject({ blockId: unit.blockId, textOffset: unit.endOffset });
    }
    const groups = groupFlowContent(chapter.units, source.blocks, [0, 1, 2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].block.kind).toBe("list");
    expect(sourceInlinesForUnit(chapter.units[1], list)).toEqual(
      child.items[0].inlines,
    );
    expect(JSON.stringify(source)).toBe(original);
  });
  it.each(["source", "translation"] as const)(
    "retains nesting, ordered starts, alpha markers, IDs and styles on the %s side",
    (side) => {
      const { source, chapter } = ordinaryNestedBilingualFixture();
      const html = renderToStaticMarkup(
        <BilingualFlowContent
          chapter={chapter}
          blocks={source.blocks}
          unitIndexes={[0, 1, 2]}
          side={side}
          pageHeight={600}
        />,
      );
      const lists = markupNodes(html, "ol"),
        items = markupNodes(html, "li");
      expect(lists.map((list) => attribute(list, "start"))).toEqual(["3", "2"]);
      expect(attribute(lists[1], "style")).toContain(
        "list-style-type:lower-alpha",
      );
      expect(items.map((item) => attribute(item, "value"))).toEqual([
        "3",
        "2",
        "4",
      ]);
      const nested = items.find(
        (item) => attribute(item, "data-bilingual-flow-item") === "nested",
      )!;
      expect(markupText(nested)).toBe(
        `${side === "translation" ? "FR " : ""}Nested 😀.`,
      );
      expect(attribute(nested, "style")).toContain("font-weight:400");
      expect(attribute(nested, "style")).toContain("text-align:center");
      expect(attribute(nested, "style")).toContain("text-indent:0em");
      if (side === "source") {
        expect(html).toContain('data-block-id="nested"');
        expect(html).toContain("font-weight:600");
      } else expect(html).not.toContain('data-reader-block="true"');
    },
  );
  it("retains the parent hierarchy on a page containing only a continued nested item", () => {
    const { source, chapter } = ordinaryNestedBilingualFixture();
    chapter.units[1] = { ...chapter.units[1], text: "😀.", startOffset: 7 };
    const html = renderToStaticMarkup(
      <BilingualFlowContent
        chapter={chapter}
        blocks={source.blocks}
        unitIndexes={[1]}
        side="source"
        pageHeight={600}
      />,
    );
    expect(markupNodes(html, "ol")).toHaveLength(2);
    expect(
      markupNodes(html, "li").map((item) => attribute(item, "style")),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("list-style-type:none")]),
    );
    expect(markupText(markupNodes(html, "li")[1])).toBe("😀.");
  });
});
