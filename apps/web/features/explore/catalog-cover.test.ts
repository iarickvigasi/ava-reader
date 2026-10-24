import { expect, it } from "vitest";
import type { CatalogWork } from "@/lib/catalog-types";
import { catalogCover } from "./catalog-cover";

it("uses provider URLs from work or representative edition data", () => {
  const work: CatalogWork = {
    id: "work",
    originalTitle: "Book",
    originalLanguage: null,
    credits: [],
    texts: [],
    coverImageUrl: "https://publisher.example/work.png",
    editions: [{ coverImageUrl: "https://cdn.example/edition.webp" }],
  };
  expect(catalogCover(work)).toBe("https://publisher.example/work.png");
  expect(catalogCover({ ...work, coverImageUrl: null })).toBe(
    "https://cdn.example/edition.webp",
  );
  expect(
    catalogCover({ ...work, coverImageUrl: null, editions: [] }),
  ).toBeNull();
});
