import { expect, it } from "vitest";
import { selectionNarrationInput } from "./selection-narration-input";
import { book, locator } from "./selection-narration-fixture";
import type { ReaderChapterPayload, ReaderRangeLocator } from "@/lib/api-types";
const sentence = "生まれた子は元気に生きる";
const start = sentence.lastIndexOf("生");
it("captures the second occurrence from durable source locator without changing it", () => {
  const selectedLocator = {
    ...locator,
    startOffset: start,
    endOffset: start + 1,
  };
  const input = selectionNarrationInput({
    book,
    chapters: [
      {
        chapterId: "one",
        blocks: [{ id: "first", kind: "paragraph", text: sentence }],
      },
    ] as ReaderChapterPayload[],
    text: "生",
    locator: selectedLocator,
    context: null,
  });
  expect(input.contextOffset).toBe(start);
  expect(selectedLocator.startOffset).toBe(start);
});
it("preserves an ephemeral bilingual offset while removing the language prefix", () => {
  const prefix = "Selected text language: Japanese.\n";
  const input = selectionNarrationInput({
    book,
    chapters: [],
    text: "生",
    locator: {
      ...locator,
      translation: { targetLang: "Japanese" },
    } as ReaderRangeLocator,
    context: prefix + sentence,
    contextOffset: prefix.length + start,
  });
  expect(input.context).toBe(sentence);
  expect(input.contextOffset).toBe(start);
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
