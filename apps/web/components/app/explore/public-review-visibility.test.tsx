import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import type { CatalogWork, CatalogReadingAsset } from "@/lib/catalog-types";
import { CatalogBookHero } from "./catalog-book-hero";
import { CatalogReadingAssets } from "./catalog-reading-assets";
vi.mock("./catalog-book-reading", () => ({
  CatalogBookReading: () => <button>Read</button>,
}));
vi.mock("./catalog-read-button", () => ({
  CatalogReadButton: () => <button>Read</button>,
}));
vi.mock("./catalog-reading-estimates", () => ({
  CatalogReadingEstimates: () => null,
}));
vi.mock("@/components/app/shared/books/book-cover-panel", () => ({
  BookCoverPanel: () => null,
}));
const asset = {
  id: "file",
  mainCatalogEntryId: "entry",
  edition: {
    id: "edition",
    title: "Emma",
    language: "en",
    format: "EBOOK",
    publishedYear: 1815,
  },
  rightsUrl: "https://example.org/review",
  rightsStatement:
    "Administrator authorized publication; rights and quality review pending.",
  rightsJurisdiction: "Not reviewed",
} as CatalogReadingAsset;
const work: CatalogWork = {
  id: "work",
  originalTitle: "Emma",
  originalLanguage: "en",
  texts: [],
  credits: [],
  readingAssets: [asset],
};
it("does not show the leftover review link in a public work header", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <CatalogBookHero
        work={work}
        edition={asset.edition}
        readingDetails={null}
      />,
    ),
  );
  expect(html).toContain("Emma");
  expect(html).toContain("Read");
  expect(html).not.toContain("Administrator authorized");
  expect(html).not.toContain("Not reviewed");
  expect(html).not.toContain(asset.rightsUrl);
});
it("does not leak review links when multiple readable files are listed", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <CatalogReadingAssets assets={[asset, { ...asset, id: "second" }]} />,
    ),
  );
  expect(html).toContain("Emma");
  expect(html).toContain("Read");
  expect(html).not.toContain(asset.rightsStatement);
  expect(html).not.toContain(asset.rightsUrl);
});
