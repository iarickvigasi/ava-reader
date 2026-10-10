import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { canonicalFixture } from "./fixtures/payload";
import { canonicalBlock } from "./blocks";
import { ReaderBlockView } from "@/components/app/reader/content/reader-block-view";

describe("canonical note role conservation", () => {
  it.each(["footnote", "endnote"] as const)(
    "retains %s from the accepted graph through flattening and DOM",
    (noteRole) => {
      const payload = canonicalFixture(),
        book = payload.readerPackage!.book;
      const note = book.blocks.find((block) => block.kind === "note");
      if (!note || note.kind !== "note")
        throw new Error("Missing authored note fixture");
      note.note_role = noteRole;
      const original = JSON.stringify(book);
      const block = canonicalBlock(book, note.id, payload.resourceUrls!);
      expect(block).toMatchObject({
        kind: "note",
        noteRole,
        text: note.content.text,
        canonicalText: note.content,
      });
      if (block.kind !== "note") throw new Error("Missing flattened note");
      expect(block.returns?.map((item) => item.label)).toEqual(
        note.callout_ids,
      );
      const chapter = book.chapters.find((chapter) =>
        chapter.block_ids.includes(note.id),
      );
      if (!chapter) throw new Error("Missing authored note chapter");
      const html = renderToStaticMarkup(
        <ReaderBlockView
          block={block}
          chapterId={chapter.id}
          pageHeight={700}
        />,
      );
      expect(html).toContain(
        `role="${noteRole === "endnote" ? "doc-endnotes" : "doc-footnote"}"`,
      );
      expect(html).toContain(`data-block-id="${note.id}"`);
      expect(html).toContain(note.content.text);
      expect(JSON.stringify(book)).toBe(original);
    },
  );
});
