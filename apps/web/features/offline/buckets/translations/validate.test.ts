import { describe, expect, it } from "vitest";
import { chapter } from "./test-fixtures";
import { validateTranslationChapter } from "./validate";

describe("translation response validation", () => {
  it("accepts a valid chapter without replacing its identity", () => {
    expect(validateTranslationChapter(chapter, chapter)).toBe(chapter);
  });

  it.each([null, [], "chapter", { ...chapter, contentRevision: 12 }])(
    "rejects malformed chapter data: %j",
    (value) => {
      expect(() => validateTranslationChapter(value, chapter)).toThrow();
    },
  );

  it.each([
    { id: 12 },
    { blockId: null },
    { text: false },
    { itemId: 12 },
    { startOffset: "0" },
    { endOffset: null },
    { endOffset: -1 },
  ])("rejects malformed sentence fields: %j", (fields) => {
    const value = { ...chapter, units: [{ ...chapter.units[0], ...fields }] };
    expect(() => validateTranslationChapter(value, chapter)).toThrow();
  });

  it("rejects duplicate sentence identities", () => {
    const value = { ...chapter, units: [chapter.units[0], chapter.units[0]] };
    expect(() => validateTranslationChapter(value, chapter)).toThrow();
  });
});
