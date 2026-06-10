import { describe, expect, it } from "vitest";

import {
  countTocChapterIds,
  shouldShowPartialOfflineNotice,
} from "./partial-offline";

describe("shouldShowPartialOfflineNotice", () => {
  const base = {
    online: false,
    offlineState: "auto" as const,
    cachedChapterCount: 3,
    totalChapterCount: 10,
  };

  it("shows when offline, partially cached, and not explicitly saved", () => {
    expect(shouldShowPartialOfflineNotice(base)).toBe(true);
  });

  it("hides when online (auto-save is completing the download)", () => {
    expect(shouldShowPartialOfflineNotice({ ...base, online: true })).toBe(false);
  });

  it("hides when the book is explicitly saved (whole book)", () => {
    expect(
      shouldShowPartialOfflineNotice({ ...base, offlineState: "explicit" }),
    ).toBe(false);
  });

  it("hides when every chapter is already cached", () => {
    expect(
      shouldShowPartialOfflineNotice({ ...base, cachedChapterCount: 10 }),
    ).toBe(false);
  });

  it("hides when the total is unknown (empty TOC) — don't guess", () => {
    expect(
      shouldShowPartialOfflineNotice({
        ...base,
        cachedChapterCount: 0,
        totalChapterCount: 0,
      }),
    ).toBe(false);
  });
});

describe("countTocChapterIds", () => {
  it("counts unique chapter ids across nested TOC nodes", () => {
    const toc = [
      { chapterId: "a", children: [] },
      {
        chapterId: null,
        children: [
          { chapterId: "b", children: [] },
          { chapterId: "c", children: [{ chapterId: "d", children: [] }] },
        ],
      },
    ];
    expect(countTocChapterIds(toc)).toBe(4);
  });

  it("ignores null chapter ids and de-dupes repeats", () => {
    const toc = [
      { chapterId: "a", children: [] },
      { chapterId: "a", children: [] },
      { chapterId: null, children: [] },
    ];
    expect(countTocChapterIds(toc)).toBe(1);
  });
});
