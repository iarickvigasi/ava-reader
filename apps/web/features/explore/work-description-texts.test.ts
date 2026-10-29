import { expect, it } from "vitest";
import { workDescriptionTexts } from "./work-description-texts";
it("prefers a real imported EPUB description with the edition language", () => {
  expect(
    workDescriptionTexts(
      [{ locale: "en", description: "Catalog description" }],
      "EPUB description",
      "fr",
    ),
  ).toEqual([{ locale: "fr", description: "EPUB description" }]);
});
it("falls back to catalog descriptions for missing or empty EPUB descriptions", () => {
  const texts = [{ locale: "en", description: "Catalog description" }];
  expect(workDescriptionTexts(texts, "<p> </p>")).toEqual(texts);
  expect(workDescriptionTexts(texts, null)).toEqual(texts);
});
it("returns no description for title-only catalog text", () => {
  expect(workDescriptionTexts([{ locale: "en", title: "Book" }], null)).toEqual(
    [],
  );
});
