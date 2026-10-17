import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReaderBlockView } from "@/components/app/reader/content/reader-block-view";
import colors from "../../content/reader-color-scheme.module.css";
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
      pageHeight={400}
    />,
  );
}

describe("bilingual paragraph flow", () => {
  it("renders consecutive original sentences inside one paragraph with exact typography and source text", () => {
    const html = render([0, 1]);
    const paragraphs = markupNodes(html, "p");
    const original = markupNodes(
      renderToStaticMarkup(
        <ReaderBlockView
          block={flowBlocks[0]}
          chapterId="chapter"
          pageHeight={400}
        />,
      ),
      "p",
    )[0];
    expect(paragraphs).toHaveLength(1);
    expect(markupText(paragraphs[0])).toBe("One. Two.");
    expect(attribute(paragraphs[0], "class")).toBe(
      attribute(original, "class"),
    );
    expect(attribute(paragraphs[0], "style")).toBe(
      attribute(original, "style"),
    );
    expect(html).toContain('data-bilingual-unit-id="one"');
    expect(html).toContain('data-bilingual-unit-id="two"');
    expect(html).toContain('data-reader-start-offset="5"');
    expect(html).toContain("font-bold");
    expect(html).not.toContain('style="height:');
  });

  it("joins trimmed translations with one space and gives them no source locators", () => {
    const html = render([0, 1], "translation");
    const paragraphs = markupNodes(html, "p");
    expect(paragraphs).toHaveLength(1);
    expect(markupText(paragraphs[0])).toBe("Uno. Dos.");
    expect(html).not.toContain("data-reader-block=");
    expect(html).not.toContain("data-block-id=");
    expect(html).toContain('data-bilingual-unit-index="1"');
  });

  it("suppresses repeated paragraph indentation when a page starts with a later sentence", () => {
    for (const side of ["source", "translation"] as const) {
      const paragraph = markupNodes(render([1], side), "p")[0];
      expect(attribute(paragraph, "style")).toContain("text-indent:0");
      expect(markupText(paragraph)).toBe(side === "source" ? "Two." : "Dos.");
    }
  });

  it("keeps distinct original blocks separate without adding sentence row padding", () => {
    const html = render([0, 1, 2]);
    expect(markupNodes(html, "p")).toHaveLength(1);
    expect(markupNodes(html, "blockquote")).toHaveLength(1);
    expect(
      markupNodes(html, "div").filter(
        (node) => attribute(node, "data-bilingual-flow-block") !== undefined,
      ),
    ).toHaveLength(2);
    expect(html).not.toContain("margin-top:");
  });
});

it.each(["source", "translation"] as const)(
  "scopes copied source colors in %s content and measurements",
  (side) => {
    const before = JSON.stringify(flowBlocks);
    const blocks = structuredClone(flowBlocks);
    blocks[0].presentation = { id: "print-ink", color: "#231f20" };
    const html = renderToStaticMarkup(
      <BilingualFlowContent
        chapter={flowChapter}
        blocks={blocks}
        unitIndexes={[0, 1]}
        side={side}
        pageHeight={400}
      />,
    );
    expect(attribute(markupNodes(html, "div")[0], "class")).toContain(
      colors.source,
    );
    expect(attribute(markupNodes(html, "p")[0], "style")).toContain(
      "color:light-dark(#231f20, #b3aea8)",
    );
    expect(markupText(markupNodes(html, "p")[0])).toBe(
      side === "source" ? "One. Two." : "Uno. Dos.",
    );
    expect(JSON.stringify(flowBlocks)).toBe(before);
  },
);
