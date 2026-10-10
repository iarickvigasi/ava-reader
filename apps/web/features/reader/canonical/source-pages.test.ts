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
  it("disables an unknown continuation in a fixed legacy book", () => {
    const book = canonicalFixture().readerPackage!.book;
    const body = book.blocks.find((b) => b.id === "body-one")!;
    body.evidence.push({ ...body.evidence[0], page: 2 });
    expect(canonicalSourcePages(book)[1].target).toBeNull();
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

function pageBook(blockId = "body-one", offset = 2) {
  const book = canonicalFixture().readerPackage!.book;
  const block = book.blocks.find((value) => value.id === blockId)!;
  block.evidence.push({ ...block.evidence[0], page: 2 });
  book.addresses.push(
    {
      resource_path: "text/chapter-one.xhtml",
      fragment: "ava-source-page-1",
      source_page: 1,
      target: {
        kind: "internal",
        chapter_id: "chapter-one",
        block_id: "heading-one",
        offset: 0,
      },
    },
    {
      resource_path: "text/chapter-one.xhtml",
      fragment: "ava-source-page-2",
      source_page: 2,
      target: {
        kind: "internal",
        chapter_id: "chapter-one",
        block_id: blockId,
        offset,
      },
    },
  );
  return book;
}

describe("exact source-page addresses", () => {
  it("uses the stored continuation and converts codepoints after an emoji", () => {
    const book = pageBook();
    book.pages[0].label = "iv";
    book.pages[1].label = "iv";
    expect(canonicalSourcePages(book)[1]).toEqual({
      number: 2,
      label: "iv",
      target: { chapterId: "chapter-one", blockId: "body-one", textOffset: 3 },
    });
    expect(
      book.blocks.find((block) => block.id === "body-one")!.evidence[0].page,
    ).toBe(1);
  });
  it("retains combining characters and the exact supplied continuation offset", () => {
    const book = pageBook("body-one", 9);
    const block = book.blocks.find((value) => value.id === "body-one")!;
    if (!("content" in block)) throw new Error("fixture needs text");
    block.content.text = "A😀B | é\nSecond";
    block.content.codepoint_utf16 = [
      0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ];
    expect(canonicalSourcePages(book)[1].target?.textOffset).toBe(10);
    expect(block.content.text.slice(10)).toBe("Second");
  });
  it.each(["list-child", "table-one", "figure-one"])(
    "keeps a marked %s start on its explicit owning target",
    (id) => {
      expect(canonicalSourcePages(pageBook(id, 0))[1].target).toEqual({
        chapterId: "chapter-one",
        blockId: id,
        textOffset: 0,
      });
    },
  );
  it("does not treat an unmarked reserved-looking ordinary address as a page map", () => {
    const book = canonicalFixture().readerPackage!.book;
    book.addresses[0].fragment = "ava-source-page-2";
    expect(canonicalSourcePages(book)[1].target?.blockId).toBe("heading-two");
  });
  it("does not fall back to evidence when a marked map has no page address", () => {
    const book = pageBook();
    const pageAddress = book.addresses.findIndex(
      (address) => address.source_page === 2,
    );
    expect(pageAddress).toBeGreaterThanOrEqual(0);
    book.addresses.splice(pageAddress, 1);
    expect(canonicalSourcePages(book)[1].target).toBeNull();
  });
  it("keeps blank physical pages without a target in a mapped book", () => {
    const book = pageBook();
    book.pages.push({ ...book.pages[1], number: 3, label: "" });
    expect(canonicalSourcePages(book)[2]).toEqual({
      number: 3,
      label: "",
      target: null,
    });
  });
  it("refuses duplicate marked page addresses instead of silently choosing one", () => {
    const book = pageBook();
    book.addresses.push({ ...book.addresses.at(-1)! });
    expect(() => canonicalSourcePages(book)).toThrow(
      "Duplicate canonical source page",
    );
  });
});
