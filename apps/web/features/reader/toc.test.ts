import { describe, expect, it } from "vitest";
import type { ReaderTocNode } from "@/lib/api-types";
import {
  countUniqueTocChapters,
  findActiveTocPathIds,
  resolveTocNavigationTarget,
} from "./toc";

describe("reader toc helpers", () => {
  it("counts unique chapters across nested toc nodes", () => {
    expect(countUniqueTocChapters(createNestedToc())).toBe(2);
  });

  it("prefers exact subsection matches when resolving the active path", () => {
    expect(
      findActiveTocPathIds(createNestedToc(), {
        activeBlockId: "chapter-1::b2",
        activeChapterId: "chapter-1",
      }),
    ).toEqual(["toc:0", "toc:0.0"]);
  });

  it("falls back to the active chapter path when there is no exact block match", () => {
    expect(
      findActiveTocPathIds(createNestedToc(), {
        activeBlockId: "chapter-1::missing",
        activeChapterId: "chapter-1",
      }),
    ).toEqual(["toc:0"]);
  });

  it("resolves subsection entries to block navigation targets", () => {
    const firstNode = createNestedToc()[0];

    if (!firstNode) {
      throw new Error("Expected the nested toc fixture to include a first node.");
    }

    const firstChild = firstNode.children[0];

    if (!firstChild) {
      throw new Error("Expected the nested toc fixture to include a child node.");
    }

    expect(resolveTocNavigationTarget(firstChild)).toEqual({
      blockId: "chapter-1::b2",
      textOffset: 0,
    });
  });
});

function createNestedToc(): ReaderTocNode[] {
  return [
    {
      anchorId: null,
      blockId: null,
      chapterId: "chapter-1",
      children: [
        {
          anchorId: "section-1",
          blockId: "chapter-1::b2",
          chapterId: "chapter-1",
          children: [],
          href: "text/chapter-1.xhtml#section-1",
          id: "toc:0.0",
          label: "Section 1",
          spineIndex: 0,
        },
      ],
      href: "text/chapter-1.xhtml",
      id: "toc:0",
      label: "Chapter One",
      spineIndex: 0,
    },
    {
      anchorId: null,
      blockId: null,
      chapterId: null,
      children: [
        {
          anchorId: null,
          blockId: null,
          chapterId: "chapter-2",
          children: [],
          href: "text/chapter-2.xhtml",
          id: "toc:1.0",
          label: "Chapter Two",
          spineIndex: 1,
        },
      ],
      href: null,
      id: "toc:1",
      label: "Part II",
      spineIndex: null,
    },
  ];
}
