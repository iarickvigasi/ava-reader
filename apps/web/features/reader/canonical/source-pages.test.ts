import { describe, expect, it } from "vitest";
import { canonicalFixture } from "./fixtures/payload";
import { canonicalSourcePages } from "./source-pages";

describe("source-page navigation matches the exported page-list", () => {
  it("uses physical source order and preserves repeated printed labels", () => {
    const book = canonicalFixture().readerPackage!.book;
    book.pages[0].label = "iv";
    book.pages[1].label = "iv";
    expect(canonicalSourcePages(book)).toEqual([
      {
        number: 1,
        label: "iv",
        target: {
          chapterId: "chapter-one",
          blockId: "heading-one",
          textOffset: 0,
        },
      },
      {
        number: 2,
        label: "iv",
        target: {
          chapterId: "chapter-two",
          blockId: "heading-two",
          textOffset: 0,
        },
      },
    ]);
  });
  it.each(["list-child", "table-one", "figure-one"])(
    "follows chapter/body order for a first %s source occurrence",
    (id) => {
      const book = canonicalFixture().readerPackage!.book;
      const first = book.chapters.find((c) => c.id === book.spine[0])!;
      first.block_ids = [id, ...first.block_ids.filter((b) => b !== id)];
      // Storage array order is not presentation order.
      book.blocks.reverse();
      expect(canonicalSourcePages(book)[0].target).toEqual({
        chapterId: "chapter-one",
        blockId: id,
        textOffset: 0,
      });
    },
  );
  it("does not invent an intra-text boundary for a joined paragraph", () => {
    const book = canonicalFixture().readerPackage!.book;
    const body = book.blocks.find((b) => b.id === "body-one")!;
    body.evidence.push({ ...body.evidence[0], page: 2 });
    expect(canonicalSourcePages(book)[1].target).toEqual({
      chapterId: "chapter-one",
      blockId: "body-one",
      textOffset: 0,
    });
  });
  it("retains a blank source page without substituting unrelated content", () => {
    const book = canonicalFixture().readerPackage!.book;
    book.pages.push({ ...book.pages[1], number: 3, label: "" });
    expect(canonicalSourcePages(book)[2]).toEqual({
      number: 3,
      label: "",
      target: null,
    });
  });
});
