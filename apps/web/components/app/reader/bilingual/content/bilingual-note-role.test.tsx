import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { ReaderTextBlock } from "@/lib/api-types/reader-content";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { BilingualFlowContent } from "./bilingual-flow-content";

it.each(["footnote", "endnote"] as const)(
  "retains explicit %s semantics in both existing reading modes",
  (noteRole) => {
    const block: ReaderTextBlock = {
      kind: "note",
      noteRole,
      id: "note",
      text: "Note.",
      inlines: [{ kind: "text", text: "Note." }],
    };
    const chapter: BilingualChapter = {
      libraryItemId: "book",
      chapterId: "notes",
      contentRevision: "r",
      translationVersion: 1,
      targetLang: "fr",
      units: [
        {
          id: "unit",
          blockId: "note",
          kind: "sentence",
          text: "Note.",
          startOffset: 0,
          endOffset: 5,
        },
      ],
      translations: { unit: "FR Note." },
    };
    for (const side of ["source", "translation"] as const) {
      const html = renderToStaticMarkup(
        <BilingualFlowContent
          chapter={chapter}
          blocks={[block]}
          unitIndexes={[0]}
          side={side}
          pageHeight={600}
        />,
      );
      expect(html).toContain(
        `role="${noteRole === "endnote" ? "doc-endnotes" : "doc-footnote"}"`,
      );
    }
  },
);
