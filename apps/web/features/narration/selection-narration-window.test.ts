import { expect, it } from "vitest";
import type {
  ReaderBookPayload,
  ReaderChapterPayload,
  ReaderRangeLocator,
} from "@/lib/api-types";
import { selectionNarrationInput } from "./selection-narration-input";
const book = { language: "en" } as ReaderBookPayload;
const chapters: ReaderChapterPayload[] = [];
const locator = {
  chapterId: "one",
  startBlockId: "first",
  endBlockId: "first",
} as ReaderRangeLocator;
it("bounds unusually long sentences near the selected fragment", () => {
  const text = "a".repeat(10000) + "bonjour" + "b".repeat(10000) + ".";
  const input = selectionNarrationInput({
    book,
    chapters: [
      { chapterId: "one", blocks: [{ id: "first", kind: "paragraph", text }] },
    ] as ReaderChapterPayload[],
    text: "bonjour",
    locator: { ...locator, startOffset: 10000, endOffset: 10007 },
    context: null,
  });
  expect(input.context?.length).toBeLessThanOrEqual(8192);
  expect(input.context).toContain("bonjour");
});

it("does not invent context when the source locator is unavailable", () => {
  expect(
    selectionNarrationInput({
      book,
      chapters,
      text: "hello",
      locator: null,
      context: null,
    }).context,
  ).toBeUndefined();
});
