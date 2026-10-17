import canonical from "./fixtures/canonical.json";
import { describe, expect, it } from "vitest";
import { canonicalFixture } from "./fixtures/payload";
import oracle from "./fixtures/oracle.json";
import { readerLeaves, resolveJumpTarget } from "../jump-target";
import { canonicalTarget } from "./inlines";
import { canonicalPayload } from "./payload";
import { canonicalStyle } from "./style";

describe("independent canonical reader oracle", () => {
  it("preserves every text leaf, original graph and complete spine", () => {
    const payload = canonicalFixture();
    expect(payload.chapters.map((item) => item.chapterId)).toEqual(
      oracle.spine,
    );
    const text = new Map(
      payload.chapters
        .flatMap((chapter) => readerLeaves(chapter.blocks))
        .map((block) => [block.id, block.text]),
    );
    for (const [id, expected] of Object.entries(oracle.text_by_id))
      expect(text.get(id), id).toBe(expected);
    expect(payload.readerPackage?.book.pages).toMatchObject(canonical.pages);
  });
  it("maps emoji code points to UTF16 without splitting a surrogate", () => {
    const payload = canonicalFixture();
    const target = {
      kind: "internal" as const,
      chapter_id: "chapter-one",
      block_id: "body-one",
      offset: 2,
    };
    expect(
      canonicalTarget(payload.readerPackage!.book, target).textOffset,
    ).toBe(3);
    expect(
      resolveJumpTarget(payload.chapters[0], {
        blockId: "body-one",
        textOffset: 2,
      }),
    ).toBeNull();
  });
  it("preserves two independent callers of the same cold note", () => {
    const blocks = canonicalFixture().chapters.flatMap((chapter) =>
      readerLeaves(chapter.blocks),
    );
    const body = blocks.find((block) => block.id === "body-one")!;
    if (!("inlines" in body)) throw new Error("Missing prose");
    const links = body.inlines.filter(
      (inline) => inline.kind === "text" && inline.target,
    );
    expect(links).toHaveLength(2);
    expect(
      links.map((link) => link.kind === "text" && link.sourceOffset),
    ).toEqual([26, 40]);
    const note = blocks.find((block) => block.id === "note-one");
    expect(
      note?.kind === "note" &&
        note.returns?.map((item) => item.target.textOffset),
    ).toEqual([26, 40]);
  });
  it("retains false and zero overrides", () => {
    const style = canonicalFixture().readerPackage!.book.styles.find(
      (item) => item.id === "normal-reset",
    );
    expect(canonicalStyle(style)).toMatchObject({
      fontWeight: 400,
      fontStyle: "normal",
      fontVariant: "normal",
      textIndent: "0em",
      marginTop: "0em",
    });
  });
  it("refuses missing chapters and resources", () => {
    const payload = canonicalFixture();
    expect(() =>
      canonicalPayload({ ...payload, activeChapterId: "missing" }),
    ).toThrow();
    expect(() => canonicalPayload({ ...payload, resourceUrls: {} })).toThrow();
    expect(
      resolveJumpTarget(payload.chapters[0], { blockId: "missing" }),
    ).toBeNull();
  });
});
