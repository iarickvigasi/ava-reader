import { expect, it } from "vitest";
import type { CatalogEditionDetail } from "@/lib/catalog-types";
import { editionHeader } from "./edition-header";
const author = (id: string, role = "AUTHOR") => ({
  role,
  creditedAs: null,
  author: { id, displayName: id },
});
const edition = {
  coverImageUrl: "edition.jpg",
  credits: [author("Translator", "TRANSLATOR")],
  work: {
    coverImageUrl: "https://example.org/work.jpg",
    credits: [author("Work author")],
  },
} as CatalogEditionDetail;
it("prefers the separate edition cover and falls back to the work author, never the translator", () => {
  expect(editionHeader(edition)).toEqual({
    coverImageUrl: "edition.jpg",
    authors: [{ id: "Work author", name: "Work author" }],
  });
});
it("uses explicit edition authors and falls back to the work cover only when necessary", () => {
  expect(
    editionHeader({
      ...edition,
      coverImageUrl: null,
      credits: [author("Edition author")],
    }),
  ).toEqual({
    coverImageUrl: "https://example.org/work.jpg",
    authors: [{ id: "Edition author", name: "Edition author" }],
  });
});

it("uses a sibling edition cover when this edition and its work have none", () => {
  expect(
    editionHeader({
      ...edition,
      coverImageUrl: null,
      work: {
        ...edition.work,
        coverImageUrl: null,
        editions: [{ coverImageUrl: "https://example.org/sibling.jpg" }],
      },
    }).coverImageUrl,
  ).toBe("https://example.org/sibling.jpg");
});
