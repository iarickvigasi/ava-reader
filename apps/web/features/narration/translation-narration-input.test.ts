import { expect, it } from "vitest";
import { translationNarrationInput } from "./translation-narration-input";

it.each([
  ["Hebrew", "he"],
  ["Indonesian", "id"],
  ["Javanese", "jv"],
])("canonicalizes %s output language", (language, code) => {
  expect(
    translationNarrationInput({ text: "text", language }).translationLanguage,
  ).toBe(code);
});

it("keeps foreign names disambiguated by the original without speaking that original", () => {
  const input = translationNarrationInput({
    text: "Ryunosuke Akutagawa",
    language: "Ukrainian",
    source: {
      text: "芥川龍之介",
      bookTitle: "羅生門",
      author: "芥川龍之介",
      context: "或日の暮方の事である。",
    },
  });
  expect(input.text).toBe("Ryunosuke Akutagawa");
  expect(input.translationLanguage).toBe("uk");
  expect(input.context).toContain("Original selection: 芥川龍之介");
  expect(input.context).toContain("Book: 羅生門");
  expect(input.context).toContain("或日の暮方の事である。");
});
