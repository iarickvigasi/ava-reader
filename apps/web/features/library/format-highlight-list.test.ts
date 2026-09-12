import { describe, expect, it } from "vitest";
import type { HighlightRecord } from "@/features/offline/buckets/highlights";
import { formatHighlightList } from "./format-highlight-list";

const highlight: HighlightRecord = {
  id: "highlight", excerpt: "First paragraph.\n\nДруги пасус 🌿\nFinal line.", color: "jade",
  createdAt: "2026-09-12", updatedAt: "2026-09-12",
  locator: {
    chapterId: "chapter", startBlockId: "a", startOffset: 0, endBlockId: "b", endOffset: 3,
    contextBefore: "", contextAfter: "",
  },
};

describe("formatHighlightList", () => {
  it("includes cached chapter names and preserves complete Unicode passages and paragraphs", () => {
    const text = formatHighlightList([highlight], new Map([["chapter", "Глава 1"]]));
    expect(text).toBe("Глава 1\n\nFirst paragraph.\n\nДруги пасус 🌿\nFinal line.");
  });

  it("copies every item in input order, including well beyond a viewport", () => {
    const highlights = Array.from({ length: 31 }, (_, index) => ({
      ...highlight, id: `h${index}`, excerpt: `Passage [${30 - index}]`, locator: null,
    }));
    const entries = formatHighlightList(highlights, new Map()).split("\n\n---\n\n");
    expect(entries).toHaveLength(31);
    expect(entries[0]).toBe("Passage [30]");
    expect(entries[15]).toBe("Passage [15]");
    expect(entries[30]).toBe("Passage [0]");
    expect(highlights[0].id).toBe("h0");
  });

  it("omits missing chapter metadata without trimming passage whitespace", () => {
    const excerpt = "  First line.\n\nSecond line.\n";
    expect(formatHighlightList([{ ...highlight, excerpt }], new Map())).toBe(excerpt);
    expect(formatHighlightList([{ ...highlight, excerpt, locator: null }], new Map())).toBe(excerpt);
  });

  it("returns no text for an empty list", () => {
    expect(formatHighlightList([], new Map())).toBe("");
  });
});
