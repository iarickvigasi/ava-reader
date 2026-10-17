import { describe, expect, it } from "vitest";
import { ordinaryReferenceChapter } from "./ordinary-reference-fixture";
import { readerLeaves, resolveJumpTarget } from "./jump-target";

const chapter = ordinaryReferenceChapter();
describe("ordinary EPUB reference destinations", () => {
  it("indexes nested list items and cells exactly once in source order", () => {
    const leaves = readerLeaves(chapter.blocks);
    expect(leaves.map((block) => block.id)).toEqual([
      "outer",
      "nested",
      "last",
      "header",
      "cell",
    ]);
    expect(leaves.map((block) => block.text).join("|")).toBe(
      "Outer.|Nested 😀.|Last.|Heading.|Cell.",
    );
  });
  it("resolves leaf references and retains explicit stored container positions", () => {
    for (const [blockId, textOffset] of [
      ["nested", 9],
      ["cell", 3],
      ["list", 7],
      ["table", 0],
    ] as const)
      expect(resolveJumpTarget(chapter, { blockId, textOffset })).toEqual({
        chapterId: "notes",
        blockId,
        textOffset,
      });
    expect(
      resolveJumpTarget(chapter, { blockId: "nested", textOffset: 99 }),
    ).toBeNull();
    expect(resolveJumpTarget(chapter, { blockId: "missing" })).toBeNull();
    expect(resolveJumpTarget(chapter)?.blockId).toBe("outer");
    expect(resolveJumpTarget(chapter, { edge: "end" })?.blockId).toBe("cell");
  });
  it("retains legacy aggregate text for explicit selection and empty list packages", () => {
    expect(readerLeaves(chapter.blocks, "list")[0].id).toBe("list");
    expect(readerLeaves(chapter.blocks, "list")[0].text).toBe(
      "Outer.\nNested 😀.\nLast.",
    );
    const legacy = {
      ...chapter.blocks[0],
      kind: "list" as const,
      ordered: false,
      items: [],
    };
    expect(readerLeaves([legacy])).toEqual([legacy]);
  });
});
