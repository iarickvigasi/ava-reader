import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReaderTextBlock } from "@/lib/api-types/reader-content";
import { ReaderBlockView } from "./reader-block-view";

function note(noteRole?: ReaderTextBlock["noteRole"]): ReaderTextBlock {
  return {
    kind: "note",
    id: "note",
    text: "A😀B note",
    inlines: [{ kind: "text", text: "A😀B note" }],
    noteRole,
    returns: [
      {
        label: "caller",
        target: { chapterId: "body", blockId: "paragraph", textOffset: 4 },
      },
    ],
  };
}
describe("supported reader note roles", () => {
  it.each(["footnote", "endnote"] as const)(
    "renders explicit %s semantics with the same source text and return actions",
    (role) => {
      const block = note(role),
        original = JSON.stringify(block);
      const html = renderToStaticMarkup(
        <ReaderBlockView block={block} chapterId="notes" pageHeight={700} />,
      );
      expect(html).toContain(
        `role="${role === "endnote" ? "doc-endnotes" : "doc-footnote"}"`,
      );
      expect(html).not.toContain(
        `role="${role === "footnote" ? "doc-endnotes" : "doc-footnote"}"`,
      );
      expect(html).not.toContain('role="doc-endnote"');
      if (role === "endnote") expect(html).toContain('<ol role="list"');
      expect(html).toContain("A😀B note");
      expect(html).toContain("Return to reference");
      expect(html).toContain("Reference 1");
      expect(JSON.stringify(block)).toBe(original);
    },
  );
  it.each([undefined, "legacy-unknown"])(
    "retains the footnote default for an unknown legacy role %s",
    (role) => {
      const html = renderToStaticMarkup(
        <ReaderBlockView
          block={note(role as ReaderTextBlock["noteRole"])}
          chapterId="notes"
          pageHeight={700}
        />,
      );
      expect(html).toContain('role="doc-footnote"');
      expect(html).not.toContain('role="doc-endnote"');
    },
  );
});
