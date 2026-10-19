import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReaderBlock } from "@/lib/api-types/reader";
import { BilingualFlowContent } from "./bilingual-flow-content";
import {
  flowChapter,
  attribute,
  markupNodes,
  markupText,
} from "./flow-test-fixture";
const blocks: ReaderBlock[] = [
  { id: "caption", kind: "caption", text: "A blue window.", inlines: [] },
  { id: "credit", kind: "credit", text: "AVA Studio", inlines: [] },
  {
    id: "image",
    kind: "image",
    text: "",
    src: "blob:window",
    alt: "Window",
    captionId: "caption",
    creditId: "credit",
  },
];
const chapter = {
  ...flowChapter,
  units: [
    ...flowChapter.units,
    {
      id: "cap",
      blockId: "caption",
      kind: "sentence" as const,
      text: "A blue window.",
      startOffset: 0,
      endOffset: 14,
    },
    {
      id: "credit",
      blockId: "credit",
      kind: "sentence" as const,
      text: "AVA Studio",
      startOffset: 0,
      endOffset: 10,
    },
  ],
  translations: { cap: "Una ventana azul.", credit: "Estudio AVA" },
};
function render(
  side: "source" | "translation",
  value = chapter,
  content = blocks,
) {
  return renderToStaticMarkup(
    <BilingualFlowContent
      chapter={value}
      blocks={content}
      unitIndexes={[6]}
      side={side}
      pageHeight={400}
    />,
  );
}
describe("bilingual illustration descriptions", () => {
  it("retains caption and credit association when only the image is on this page", () => {
    const html = render("source");
    const figure = markupNodes(html, "figure")[0];
    const caption = markupNodes(html, "figcaption")[0];
    expect(attribute(figure, "aria-describedby")).toBe(
      attribute(caption, "id"),
    );
    expect(markupText(caption)).toBe("A blue window. AVA Studio");
    expect(attribute(markupNodes(html, "img")[0], "alt")).toBe("Window");
  });
  it("uses a complete translated description without source locator attributes", () => {
    const html = render("translation");
    expect(markupText(markupNodes(html, "figcaption")[0])).toBe(
      "Una ventana azul. Estudio AVA",
    );
    expect(html).not.toContain("data-reader-block=");
  });
  it("falls back to the complete source when description translation is missing", () => {
    const html = render("translation", {
      ...chapter,
      translations: { cap: "", credit: "Estudio AVA" },
    });
    expect(markupText(markupNodes(html, "figcaption")[0])).toBe(
      "A blue window. Estudio AVA",
    );
  });
  it("does not create dangling associations for absent or unrelated targets", () => {
    const unrelated = blocks.map((block) =>
      block.kind === "caption" || block.kind === "credit"
        ? { ...block, kind: "paragraph" as const }
        : block,
    );
    for (const content of [[blocks[2]], unrelated]) {
      const html = render("source", chapter, content);
      expect(html).not.toContain("aria-describedby");
      expect(markupNodes(html, "figcaption")).toHaveLength(0);
    }
  });
  it("assigns distinct description IDs to simultaneous source and translation figures", () => {
    const html = renderToStaticMarkup(
      <>
        <BilingualFlowContent
          chapter={chapter}
          blocks={blocks}
          unitIndexes={[6]}
          side="source"
          pageHeight={400}
        />
        <BilingualFlowContent
          chapter={chapter}
          blocks={blocks}
          unitIndexes={[6]}
          side="translation"
          pageHeight={400}
        />
      </>,
    );
    const ids = markupNodes(html, "figcaption").map((node) =>
      attribute(node, "id"),
    );
    expect(new Set(ids).size).toBe(2);
    expect(
      markupNodes(html, "figure").map((node) =>
        attribute(node, "aria-describedby"),
      ),
    ).toEqual(ids);
  });
});
