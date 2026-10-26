import { expect, it } from "vitest";
import type { ReaderChapterPayload } from "@/lib/api-types";
import { mergeSearchContent } from "./merge-search-content";

const chapter: ReaderChapterPayload = {
  chapterId: "first",
  blocks: [],
  label: "First chapter",
  title: "First chapter",
  spineIndex: 0,
  href: "#first",
  previousChapterId: null,
  nextChapterId: "second",
};

it("includes cached chapters outside the reader window and reports incomplete coverage", () => {
  const cache = {
    chapters: [
      {
        libraryItemId: "book",
        chapterId: "second",
        index: 1,
        blocks: [],
        aux: undefined,
        fetchedAt: "now",
      },
    ],
    error: false,
    book: {
      libraryItemId: "book",
      chapterIds: ["first", "second"],
      toc: [],
      metadata: {},
      fetchedAt: "now",
    },
  };
  const partial = mergeSearchContent(cache, [], [chapter]);
  expect(partial.chapters.map((row) => row.chapterId)).toEqual([
    "first",
    "second",
  ]);
  expect(partial.chapters[1].label).toBe("2.");
  expect(partial.complete).toBe(false);
  cache.chapters.push({ ...cache.chapters[0], chapterId: "first", index: 0 });
  expect(mergeSearchContent(cache, [], [chapter]).complete).toBe(true);
});
