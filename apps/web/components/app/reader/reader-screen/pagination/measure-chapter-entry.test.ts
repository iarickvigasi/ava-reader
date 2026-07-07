import { describe, expect, it } from "vitest";
import { measureChapterEntry } from "./measure-chapter-entry";

describe("measureChapterEntry", () => {
  const base = {
    chapterId: "chapter-a",
    layoutKey: "layout:chapter-a",
    columnCount: 1 as const,
    pageGap: 48,
  };

  it("returns a pending entry while the chapter's refs are not both mounted", () => {
    expect(
      measureChapterEntry({ ...base, article: null, pageBox: null }).status,
    ).toBe("pending");
    expect(
      measureChapterEntry({
        ...base,
        article: {} as HTMLElement,
        pageBox: null,
      }).status,
    ).toBe("pending");
    expect(
      measureChapterEntry({
        ...base,
        article: null,
        pageBox: {} as HTMLDivElement,
      }).status,
    ).toBe("pending");
  });

  it("carries the chapterId and layoutKey onto the pending entry", () => {
    expect(
      measureChapterEntry({
        article: null,
        pageBox: null,
        chapterId: "chapter-b",
        layoutKey: "layout:chapter-b",
        columnCount: 2,
        pageGap: 48,
      }),
    ).toMatchObject({
      chapterId: "chapter-b",
      layoutKey: "layout:chapter-b",
      status: "pending",
    });
  });
});
