import { expect, it } from "vitest";
import { selectionSentenceWindow } from "./selection-sentence-context";
it.each([0, 9])(
  "keeps repeated Japanese occurrence %s within the sentence",
  (start) => {
    const text = "生まれた子は元気に生きる";
    const result = selectionSentenceWindow({
      text,
      selectedText: "生",
      start,
      end: start + 1,
      maxChars: 8192,
    });
    expect(result.contextOffset).toBe(start);
  },
);
it("adjusts UTF-16 offsets for sentence boundaries and trimmed whitespace", () => {
  const text = "前文。   😀生まれた子は生きる。";
  const start = text.lastIndexOf("生");
  const result = selectionSentenceWindow({
    text,
    selectedText: " 生 ",
    start,
    end: start + 1,
    maxChars: 8192,
  });
  expect(
    result.context.slice(result.contextOffset, result.contextOffset! + 1),
  ).toBe("生");
  expect(result.contextOffset).toBe(result.context.lastIndexOf("生"));
});
it("preserves the offset through a large context window", () => {
  const text = "a".repeat(10000) + "生きる" + "b".repeat(10000);
  const result = selectionSentenceWindow({
    text,
    selectedText: "生",
    start: 10000,
    end: 10001,
    maxChars: 8192,
  });
  expect(result.context.length).toBeLessThanOrEqual(8192);
  expect(
    result.context.slice(result.contextOffset, result.contextOffset! + 1),
  ).toBe("生");
});
it("omits exact offsets when only collapsed whitespace matches", () => {
  const result = selectionSentenceWindow({
    text: "Use C++   today.",
    selectedText: "C++ today",
    start: 4,
    end: 13,
    maxChars: 8192,
  });
  expect(result.contextOffset).toBeUndefined();
});
