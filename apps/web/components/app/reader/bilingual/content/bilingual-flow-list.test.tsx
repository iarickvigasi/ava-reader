import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BilingualFlowContent } from "./bilingual-flow-content";
import {
  attribute,
  flowBlocks,
  flowChapter,
  markupNodes,
  markupText,
} from "./flow-test-fixture";

function render(
  unitIndexes: number[],
  side: "source" | "translation" = "source",
) {
  return renderToStaticMarkup(
    <BilingualFlowContent
      chapter={flowChapter}
      blocks={flowBlocks}
      unitIndexes={unitIndexes}
      side={side}
      pageHeight={120}
    />,
  );
}

describe("bilingual list and image flow", () => {
  it("groups sentences in original list items and preserves absolute list offsets", () => {
    const html = render([3, 4, 5]);
    expect(markupNodes(html, "ol")).toHaveLength(1);
    const items = markupNodes(html, "li");
    expect(items.map(markupText)).toEqual(["First. Again.", "Second."]);
    expect(items.map((item) => attribute(item, "value"))).toEqual(["1", "2"]);
    expect(attribute(items[1], "data-reader-start-offset")).toBe("13");
    expect(html).toContain('data-bilingual-flow-item-start="13"');
  });

  it("does not repeat a continued item's marker and keeps later items' original numbers", () => {
    for (const side of ["source", "translation"] as const) {
      const items = markupNodes(render([4, 5], side), "li");
      expect(attribute(items[0], "style")).toContain("list-style-type:none");
      expect(attribute(items[1], "style")).toBeUndefined();
      expect(attribute(items[1], "value")).toBe("2");
    }
  });

  it("translates both list sentences inside the same list item", () => {
    const html = render([3, 4, 5], "translation");
    expect(markupNodes(html, "li").map(markupText)).toEqual([
      "Primero. Otra vez.",
      "Segundo.",
    ]);
    expect(html).not.toContain("data-block-id=");
  });

  it("mirrors images as one measurable unit and contains them on short pages", () => {
    for (const side of ["source", "translation"] as const) {
      const html = render([6], side);
      expect(markupNodes(html, "img")).toHaveLength(1);
      expect(attribute(markupNodes(html, "img")[0], "style")).toBe(
        "max-height:120px",
      );
      expect(
        attribute(markupNodes(html, "figure")[0], "data-bilingual-unit-id"),
      ).toBe("img");
      expect(markupText(markupNodes(html, "figure")[0])).toBe("");
    }
  });
});
