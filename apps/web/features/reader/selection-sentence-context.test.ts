import { expect, it } from "vitest";
import { selectionSentenceContext } from "./selection-sentence-context";

it("repairs DOM/source whitespace drift before selecting the sentence", () => {
  expect(
    selectionSentenceContext({
      text: "The     doctor left. Le pain est frais.",
      selectedText: "Le",
      start: 17,
      end: 19,
      maxChars: 8192,
    }),
  ).toBe("Le pain est frais.");
});

it("keeps context near a late selection in an oversized translated sentence", () => {
  const text = "a".repeat(10000) + " The French word pain means bread.";
  const context = selectionSentenceContext({
    text,
    selectedText: "pain",
    start: 10017,
    end: 10021,
    maxChars: 8000,
  });
  expect(context).toContain("The French word pain means bread.");
  expect(context.length).toBeLessThanOrEqual(8000);
});

it("chooses the closest repeated fragment, not its first occurrence", () => {
  const text = "A Gift for you. Das Gift ist gefährlich.";
  expect(
    selectionSentenceContext({
      text,
      selectedText: "Gift",
      start: 20,
      end: 24,
      maxChars: 8192,
    }),
  ).toBe("Das Gift ist gefährlich.");
});

it("matches collapsed whitespace and literal regex characters safely", () => {
  const text = "Ignore this. Use C++     today. Finish.";
  expect(
    selectionSentenceContext({
      text,
      selectedText: "C++ today",
      start: 15,
      end: 24,
      maxChars: 8192,
    }),
  ).toBe("Use C++     today.");
});
