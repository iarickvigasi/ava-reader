import { describe, expect, it, vi } from "vitest";
import type { ReaderChapterPayload, ReaderRangeLocator } from "@/lib/api-types";
import { extractSelectionContext } from "./selection-context";

// Chapter fixtures: offsets in the tests are character positions inside a
// block's flat `text`, exactly how computeAiCommentLocator measures them.
const FIRST_PARAGRAPH =
  "Darcy walked off. Elizabeth remained with no very cordial feelings toward him. She told the story with great spirit.";
const SECOND_PARAGRAPH =
  "The evening passed pleasantly. Nobody mentioned the incident again.";

function createChapter(
  overrides: Partial<ReaderChapterPayload> = {},
): ReaderChapterPayload {
  return {
    blocks: [
      {
        id: "block-1",
        inlines: [{ kind: "text", text: FIRST_PARAGRAPH }],
        kind: "paragraph",
        text: FIRST_PARAGRAPH,
      },
      {
        id: "block-2",
        inlines: [{ kind: "text", text: SECOND_PARAGRAPH }],
        kind: "paragraph",
        text: SECOND_PARAGRAPH,
      },
    ],
    chapterId: "chapter-1",
    href: "#chapter-1",
    label: "Chapter 1",
    nextChapterId: null,
    previousChapterId: null,
    spineIndex: 0,
    title: "Chapter 1",
    ...overrides,
  };
}

function createLocator(
  overrides: Partial<ReaderRangeLocator> = {},
): ReaderRangeLocator {
  return {
    chapterId: "chapter-1",
    startBlockId: "block-1",
    startOffset: 0,
    endBlockId: "block-1",
    endOffset: 10,
    contextBefore: "",
    contextAfter: "",
    ...overrides,
  };
}

describe("extractSelectionContext", () => {
  it("returns the containing sentence plus the previous sentence for a mid-block selection", () => {
    // "cordial feelings" inside the second sentence of block-1.
    const start = FIRST_PARAGRAPH.indexOf("cordial");
    const context = extractSelectionContext([createChapter()], {
      ...createLocator(),
      startOffset: start,
      endOffset: start + "cordial feelings".length,
    });

    expect(context).toBe(
      "Darcy walked off. Elizabeth remained with no very cordial feelings toward him.",
    );
  });

  it("returns only the containing sentence when the selection sits in the chapter's first sentence", () => {
    const context = extractSelectionContext([createChapter()], {
      ...createLocator(),
      startOffset: FIRST_PARAGRAPH.indexOf("walked"),
      endOffset: FIRST_PARAGRAPH.indexOf("walked") + "walked".length,
    });

    expect(context).toBe("Darcy walked off.");
  });

  it("falls back to the previous block's last sentence when the selection starts a block", () => {
    const start = SECOND_PARAGRAPH.indexOf("evening");
    const context = extractSelectionContext([createChapter()], {
      ...createLocator(),
      startBlockId: "block-2",
      endBlockId: "block-2",
      startOffset: start,
      endOffset: start + "evening".length,
    });

    expect(context).toBe(
      "She told the story with great spirit. The evening passed pleasantly.",
    );
  });

  it("returns null without a locator", () => {
    expect(extractSelectionContext([createChapter()], null)).toBeNull();
  });

  it("includes every sentence the selection overlaps", () => {
    const start = FIRST_PARAGRAPH.indexOf("cordial");
    const end = FIRST_PARAGRAPH.indexOf("story") + "story".length;
    const context = extractSelectionContext([createChapter()], {
      ...createLocator(),
      startOffset: start,
      endOffset: end,
    });

    expect(context).toBe(FIRST_PARAGRAPH);
  });

  it("extends to the start block's end when the selection crosses into another block", () => {
    const start = FIRST_PARAGRAPH.indexOf("cordial");
    const context = extractSelectionContext([createChapter()], {
      ...createLocator(),
      startOffset: start,
      endBlockId: "block-2",
      endOffset: 5,
    });

    expect(context).toBe(FIRST_PARAGRAPH);
  });

  it("returns null when the locator's chapter is outside the loaded window", () => {
    const context = extractSelectionContext([createChapter()], {
      ...createLocator(),
      chapterId: "chapter-99",
    });

    expect(context).toBeNull();
  });

  it("returns null when the start block is missing", () => {
    const context = extractSelectionContext([createChapter()], {
      ...createLocator(),
      startBlockId: "block-99",
      endBlockId: "block-99",
    });

    expect(context).toBeNull();
  });

  it("returns null when the start block is an image", () => {
    const chapter = createChapter({
      blocks: [
        {
          alt: "A portrait of the author",
          id: "block-1",
          kind: "image",
          src: "cover.png",
          text: "A portrait of the author",
        },
      ],
    });
    const context = extractSelectionContext([chapter], createLocator());

    expect(context).toBeNull();
  });

  it("clamps offsets that overshoot the block text", () => {
    const context = extractSelectionContext([createChapter()], {
      ...createLocator(),
      startOffset: FIRST_PARAGRAPH.length + 50,
      endOffset: FIRST_PARAGRAPH.length + 60,
    });

    expect(context).toBe(
      "Elizabeth remained with no very cordial feelings toward him. She told the story with great spirit.",
    );
  });

  it("collapses newlines and doubled whitespace in the derived context", () => {
    const listText = "First item one.\nSecond item two.\nThird  item three.";
    const chapter = createChapter({
      blocks: [
        {
          id: "block-1",
          items: [],
          kind: "list",
          ordered: false,
          text: listText,
        },
      ],
    });
    const start = listText.indexOf("Third");
    const context = extractSelectionContext([chapter], {
      ...createLocator(),
      startOffset: start,
      endOffset: start + "Third".length,
    });

    expect(context).toBe("Second item two. Third item three.");
  });

  it("cuts from the beginning when the context exceeds the cap, keeping the containing sentence's tail", () => {
    const longSentence = `B${"b".repeat(1599)}.`;
    const text = `Short lead. ${longSentence}`;
    const chapter = createChapter({
      blocks: [
        {
          id: "block-1",
          inlines: [{ kind: "text", text }],
          kind: "paragraph",
          text,
        },
      ],
    });
    const start = text.indexOf("B");
    const context = extractSelectionContext([chapter], {
      ...createLocator(),
      startOffset: start,
      endOffset: start + 10,
    });

    expect(context).toHaveLength(1500);
    // The head (previous sentence + the long sentence's start) is what gets
    // sacrificed; the tail nearest the selection's sentence end survives.
    expect(context?.endsWith("b.")).toBe(true);
    expect(context).not.toContain("Short lead");
  });

  it("returns null when Intl.Segmenter is unavailable", () => {
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
    try {
      expect(
        extractSelectionContext([createChapter()], createLocator()),
      ).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
