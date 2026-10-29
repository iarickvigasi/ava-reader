import { expect, it } from "vitest";
import { editData } from "./edit-data";
it("prefills localized work metadata and ordered contributors while excluding system provenance", () => {
  const data = editData("works", {
    id: "work",
    revision: 7,
    sourceMappings: [{ externalId: "OL1W" }],
    originalTitle: "Title",
    originalLanguage: "uk",
    coverImageUrl: null,
    subjects: ["Fiction"],
    categories: ["fiction"],
    texts: [{ locale: "uk", title: "Назва", description: "Опис" }],
    credits: [
      {
        author: { id: "author", displayName: "Author" },
        role: "AUTHOR",
        creditedAs: null,
      },
    ],
  });
  expect(data.credits).toEqual([
    {
      authorId: "author",
      authorName: "Author",
      role: "AUTHOR",
      creditedAs: null,
    },
  ]);
  expect(data.texts).toEqual([
    { locale: "uk", title: "Назва", description: "Опис" },
  ]);
  expect(data).not.toHaveProperty("sourceMappings");
  expect(data).not.toHaveProperty("revision");
});
