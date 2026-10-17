import { renderToStaticMarkup } from "react-dom/server";
import type { ReaderBlock } from "@/lib/api-types/reader";
import { BilingualFlowContent } from "./bilingual-flow-content";
import { flowChapter } from "./flow-test-fixture";

export const imageTarget = {
  chapterId: "notes",
  blockId: "cell",
  textOffset: 3,
};
export const styledImage: ReaderBlock = {
  id: "image",
  kind: "image",
  text: "",
  src: "blob:illustration",
  alt: "Diagram",
  width: 480,
  height: 320,
  href: "notes.xhtml#cell",
  target: imageTarget,
  sourceOffset: 0,
  presentation: {
    id: "image-style",
    space_before_em: 0,
    space_after_em: 0.25,
    block_indent_em: 1,
    align: "center",
    italic: false,
  },
};
export const literalBlocks: ReaderBlock[] = [
  {
    id: "separator",
    kind: "separator",
    text: "",
    presentation: {
      id: "separator-style",
      space_before_em: 0.2,
      space_after_em: 0,
      color: "#123456",
    },
  },
  {
    id: "verse",
    kind: "verse",
    text: "  One\n    Two\n",
    inlines: [{ kind: "text", text: "  One\n    Two\n" }],
  },
  {
    id: "code",
    kind: "code",
    text: "if (x) {\n  y();\n}\n",
    inlines: [{ kind: "text", text: "if (x) {\n  y();\n}\n" }],
  },
];
export function renderImage(side: "source" | "translation", canonical = false) {
  return renderToStaticMarkup(
    <BilingualFlowContent
      chapter={flowChapter}
      blocks={[{ ...styledImage, canonical }]}
      unitIndexes={[6]}
      side={side}
      pageHeight={400}
    />,
  );
}
export function renderLiterals(
  side: "source" | "translation",
  canonical: boolean,
) {
  const blocks = literalBlocks.map((block) => ({ ...block, canonical }));
  const units = blocks.map((block) => ({
    id: `${block.id}:literal`,
    blockId: block.id,
    kind: "literal" as const,
    text: block.text,
    startOffset: 0,
    endOffset: block.text.length,
  }));
  return renderToStaticMarkup(
    <BilingualFlowContent
      chapter={{ ...flowChapter, units, translations: {} }}
      blocks={blocks}
      unitIndexes={[0, 1, 2]}
      side={side}
      pageHeight={400}
    />,
  );
}
