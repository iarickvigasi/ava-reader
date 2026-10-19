import { describe, expect, it } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { canonicalChapters } from "@/features/reader/canonical/chapters";
import { resolveJumpTarget } from "@/features/reader/jump-target";
import { searchPassages } from "./passages";
import { findBookText } from "./find";
import { MAX_SEARCH_CHARACTERS } from "./types";
describe("immutable search graph", () => {
  it("searches the full spine beyond the current window without resources or graph mutation", () => {
    const payload = canonicalFixture();
    const original = JSON.stringify(payload);
    const passages = searchPassages({
      ...payload,
      chapters: [],
      resourceUrls: {},
    });
    const ids = passages.map((item) => item.blockId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      passages.some((item) => item.chapterId !== payload.activeChapterId),
    ).toBe(true);
    const projected = canonicalChapters(
      payload.readerPackage!.book,
      payload.resourceUrls!,
    );
    for (const passage of passages) {
      expect(passage.text).not.toBe("");
      const hit = findBookText([passage], passage.text.slice(0, 8)).hits[0];
      const chapter = projected.find(
        (item) => item.chapterId === hit.chapterId,
      )!;
      expect(resolveJumpTarget(chapter, hit)).toMatchObject({
        chapterId: hit.chapterId,
        blockId: hit.blockId,
        textOffset: hit.textOffset,
      });
    }
    expect(JSON.stringify(payload)).toBe(original);
  });
  it("includes table cells, note text, captions and list items as distinct valid leaves", () => {
    const payload = canonicalFixture();
    const passages = searchPassages(payload);
    const book = payload.readerPackage!.book;
    for (const block of book.blocks) {
      if (block.kind === "table")
        for (const cell of block.cells)
          if (cell.content.text)
            expect(passages.find((p) => p.blockId === cell.id)?.text).toBe(
              cell.content.text,
            );
      if (
        ["note", "caption", "list_item"].includes(block.kind) &&
        "content" in block
      )
        expect(passages.find((p) => p.blockId === block.id)?.text).toBe(
          block.content.text,
        );
    }
    expect(passages.some((item) => item.blockId === "image-one")).toBe(false);
  });
  it("refuses oversized content rather than truncating the search corpus", () => {
    const payload = canonicalFixture();
    const block = payload.readerPackage!.book.blocks.find(
      (block) => "content" in block,
    )!;
    if (!("content" in block)) throw new Error("Missing text");
    block.content.text = "x".repeat(MAX_SEARCH_CHARACTERS + 1);
    expect(() => searchPassages(payload)).toThrow("search limit");
  });
});
