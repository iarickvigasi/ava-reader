import { describe, expect, it } from "vitest";
import type { ReaderBlock } from "@/lib/api-types";
import { searchChapter } from "./search-chapter";
import { findMatches } from "./find-matches";

const paragraph = (text: string): ReaderBlock => ({
  id: "p",
  kind: "paragraph",
  text,
  inlines: [{ kind: "text", text }],
});
const search = (blocks: ReaderBlock[], query: string) =>
  searchChapter(
    { chapterId: "c", order: 0, label: "Chapter one", blocks },
    query,
  );

describe("book sentence search", () => {
  it("returns whole sentences once, with every match and exact source offsets", () => {
    const text = "A dog sleeps.  The cat greets another cat. Cats run.";
    const [result] = search([paragraph(text)], "cat");
    expect(search([paragraph(text)], "cat")).toHaveLength(1);
    expect(result.text).toBe("The cat greets another cat.");
    expect(result.matches).toHaveLength(2);
    expect(result.matchOffset).toBe(text.indexOf("cat"));
    expect(
      text.slice(result.locator.startOffset, result.locator.endOffset),
    ).toBe(result.text);
  });
  it("matches Unicode case and whitespace without corrupting offsets", () => {
    const text = "😀 İris waits. CAFÉ\n  au lait is ready.";
    expect(findMatches(text, "café au lait")).toEqual([
      { start: text.indexOf("CAFÉ"), end: text.indexOf(" is ready") },
    ]);
    expect(
      search([paragraph("😀 CAFÉ   au lait is ready.")], "café au lait")[0]
        .matchOffset,
    ).toBe(3);
    expect(findMatches("Été été étés", "ÉTÉ")).toHaveLength(2);
  });
  it("treats punctuation literally and accepts a full sentence", () => {
    expect(
      search([paragraph("Use a+b (now). Later.")], "a+b (now)")[0].text,
    ).toBe("Use a+b (now).");
    expect(
      search(
        [paragraph("Here is the sentence. Here is more.")],
        "Here is the sentence.",
      ),
    ).toHaveLength(1);
    expect(search([paragraph("Nothing here.")], "  ")).toEqual([]);
  });
  it("finds phrases across inline formatting", () => {
    const block = paragraph("A bold cat sleeps.");
    if (block.kind !== "paragraph") throw new Error("fixture");
    block.inlines = [
      { kind: "text", text: "A " },
      { kind: "text", text: "bold", bold: true },
      { kind: "text", text: " cat sleeps." },
    ];
    expect(search([block], "bold cat")[0].text).toBe(block.text);
  });
  it("uses raw concatenated list offsets, excluding search separators and image alt", () => {
    const blocks: ReaderBlock[] = [
      {
        id: "list",
        kind: "list",
        ordered: false,
        text: "First\nSecond cat",
        items: [
          {
            id: "a",
            text: "First",
            inlines: [{ kind: "text", text: "First" }],
          },
          {
            id: "b",
            text: "Second cat",
            inlines: [{ kind: "text", text: "Second cat" }],
          },
        ],
      },
      { id: "img", kind: "image", src: "x", alt: "cat", text: "cat" },
    ];
    const results = search(blocks, "cat");
    expect(results).toHaveLength(1);
    expect(results[0].locator.startOffset).toBe(5);
    expect(results[0].matchOffset).toBe(12);
    expect(results[0].text).toBe("Second cat");
  });
  it("keeps repeated sentences at separate locations", () => {
    const results = search([paragraph("A cat sleeps. A cat sleeps.")], "cat");
    expect(results).toHaveLength(2);
    expect(results[0].id).not.toBe(results[1].id);
  });
});
