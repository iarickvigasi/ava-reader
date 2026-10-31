import { expect, it } from "vitest";
import type { ReaderChapterPayload, ReaderRangeLocator } from "@/lib/api-types";
import { selectionNarrationInput } from "./selection-narration-input";
import {
  book,
  chapters,
  locator,
  sentence,
} from "./selection-narration-fixture";

it("captures the whole containing sentence, not the book language as a verdict", () => {
  expect(
    selectionNarrationInput({
      book,
      chapters,
      text: "bonsoir",
      locator,
      context: null,
    }),
  ).toEqual({
    text: "bonsoir",
    context: sentence,
    contextOffset: sentence.indexOf("bonsoir"),
    languageHint: "en",
  });
});

it("captures Japanese sentence context for a kanji", () => {
  const input = selectionNarrationInput({
    book: { ...book, language: "ja" },
    chapters: [
      {
        chapterId: "one",
        blocks: [
          {
            id: "first",
            kind: "paragraph",
            text: "昨日は休んだ。今日は学校へ行きます。明日は帰ります。",
          },
        ],
      },
    ] as ReaderChapterPayload[],
    text: "今日",
    locator: { ...locator, startOffset: 7, endOffset: 9 },
    context: null,
  });
  expect(input.context).toBe("今日は学校へ行きます。");
  expect(input.languageHint).toBe("ja");
});

it("uses translated context and its language hint without reading source offsets", () => {
  const translated = {
    ...locator,
    translation: { targetLang: "French", startOffset: 0, endOffset: 7 },
  } as ReaderRangeLocator;
  expect(
    selectionNarrationInput({
      book,
      chapters,
      text: "bonsoir",
      locator: translated,
      context: "Selected text language: French.\nIl a dit bonsoir.",
    }),
  ).toEqual({
    text: "bonsoir",
    context: "Il a dit bonsoir.",
    languageHint: "French",
  });
});

it("includes containing sentences across selected blocks", () => {
  const input = selectionNarrationInput({
    book,
    chapters: [
      {
        chapterId: "one",
        blocks: [
          {
            id: "first",
            kind: "paragraph",
            text: "A prior sentence. Hello there.",
          },
          {
            id: "second",
            kind: "paragraph",
            text: "Bonjour, mon ami. A later sentence.",
          },
        ],
      },
    ] as ReaderChapterPayload[],
    text: "Hello there. Bonjour, mon ami.",
    locator: {
      ...locator,
      startOffset: 18,
      endBlockId: "second",
      endOffset: 17,
    },
    context: null,
  });
  expect(input.context).toBe("Hello there.\nBonjour, mon ami.");
});
