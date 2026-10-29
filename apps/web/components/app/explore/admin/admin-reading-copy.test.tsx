import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { ReadingReview } from "@/lib/api-types/reading-review";
import { AdminReadingCopy } from "./admin-reading-copy";
vi.mock("../catalog-read-button", () => ({
  CatalogReadButton: ({ draft }: { draft: { editionId: string } }) => (
    <button data-edition={draft.editionId}>Read</button>
  ),
}));
const entry: ReadingReview = {
  id: "entry",
  editionId: "edition",
  checksum: "hash",
  title: "Book",
  authors: ["Author"],
  language: "uk",
  status: "DRAFT",
  processingStatus: "READY",
  syncPending: false,
  withdrawn: false,
  sourceUrl: "https://archive.org/details/book",
  filename: "book.epub",
  review: null,
};
it("uses Read for a prepared draft and opens publication only through a separate confirmation", () => {
  const html = renderToStaticMarkup(<AdminReadingCopy entry={entry} />);
  expect(html).toContain('data-edition="edition"');
  expect(html).toContain(">Read</button>");
  expect(html).not.toContain(">Publish</button>");
  expect(html).not.toContain("Preview");
  expect(html).not.toContain("Unpublished");
  expect(html).not.toContain("Book ·");
});
it("does not offer Read or publication for an unfinished draft", () => {
  const html = renderToStaticMarkup(
    <AdminReadingCopy entry={{ ...entry, processingStatus: "PROCESSING" }} />,
  );
  expect(html).not.toContain(">Read</button>");
  expect(html).not.toContain("<button");
  expect(
    renderToStaticMarkup(
      <AdminReadingCopy entry={{ ...entry, status: "PUBLISHED" }} />,
    ),
  ).toBe("");
});

it("offers Read again for a processed withdrawn copy so an admin can review restoration", () => {
  const html = renderToStaticMarkup(
    <AdminReadingCopy
      entry={{ ...entry, status: "ARCHIVED", withdrawn: true }}
    />,
  );
  expect(html).toContain(">Read</button>");
});
