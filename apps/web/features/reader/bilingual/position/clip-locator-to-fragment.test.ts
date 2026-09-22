import { describe, expect, it } from "vitest";
import type { ReaderRangeLocator } from "@/lib/api-types/reader";
import { clipLocatorToFragment } from "./clip-locator-to-fragment";

const locator: ReaderRangeLocator = {
  chapterId: "c",
  startBlockId: "a",
  endBlockId: "a",
  startOffset: 110,
  endOffset: 145,
  contextBefore: "",
  contextAfter: "",
};
const chapter = { chapterId: "c", blockIds: ["a", "b", "c"] };

describe("bilingual annotation clipping", () => {
  it("paints all intersecting sentence fragments sharing a block ID with local offsets", () => {
    expect(
      clipLocatorToFragment(
        locator,
        { blockId: "a", startOffset: 100, endOffset: 125 },
        chapter,
      ),
    ).toMatchObject({
      startBlockId: "a",
      startOffset: 10,
      endBlockId: "a",
      endOffset: 25,
    });
    expect(
      clipLocatorToFragment(
        locator,
        { blockId: "a", startOffset: 125, endOffset: 150 },
        chapter,
      ),
    ).toMatchObject({ startOffset: 0, endOffset: 20 });
    expect(
      clipLocatorToFragment(
        locator,
        { blockId: "a", startOffset: 150, endOffset: 175 },
        chapter,
      ),
    ).toBeNull();
  });

  it("clips a cross-block mark to visible fragments when its endpoints are off-page", () => {
    const crossBlock = { ...locator, endBlockId: "c", endOffset: 10 };
    expect(
      clipLocatorToFragment(
        crossBlock,
        { blockId: "b", startOffset: 40, endOffset: 90 },
        chapter,
      ),
    ).toMatchObject({
      startBlockId: "b",
      startOffset: 0,
      endBlockId: "b",
      endOffset: 50,
    });
    expect(
      clipLocatorToFragment(
        crossBlock,
        { blockId: "c", startOffset: 5, endOffset: 20 },
        chapter,
      ),
    ).toMatchObject({ startOffset: 0, endOffset: 5 });
  });

  it("rejects annotations in another chapter, missing endpoints, and reversed ranges", () => {
    const fragment = { blockId: "a", startOffset: 100, endOffset: 150 };
    expect(
      clipLocatorToFragment(
        { ...locator, chapterId: "other" },
        fragment,
        chapter,
      ),
    ).toBeNull();
    expect(
      clipLocatorToFragment(
        { ...locator, endBlockId: "missing" },
        fragment,
        chapter,
      ),
    ).toBeNull();
    expect(
      clipLocatorToFragment(
        { ...locator, startBlockId: "c", endBlockId: "a" },
        fragment,
        chapter,
      ),
    ).toBeNull();
    expect(clipLocatorToFragment(null, fragment, chapter)).toBeNull();
  });
});
