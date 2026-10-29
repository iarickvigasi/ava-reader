import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { FeaturedBooksSection } from "./featured-books-section";

vi.mock("@/components/app/shared/book-cover", () => ({
  BookCover: ({ title }: { title: string }) => <span>{title} cover</span>,
}));
vi.mock("./catalog-add-button", () => ({
  CatalogAddButton: () => <button>Add</button>,
}));

it.each(["edition-1", null, undefined])(
  "links mobile and desktop covers and titles only to a mapped edition (%s)",
  (editionId) => {
    const html = renderToStaticMarkup(
      withIntl(
        <FeaturedBooksSection
          entries={[
            {
              id: "main-entry",
              editionId,
              title: "Emma",
              authors: ["Jane Austen"],
              description: "A novel.",
              coverImageUrl: null,
              primaryFormat: "EPUB",
              isFeatured: true,
            },
          ]}
        />,
      ),
    );
    const links =
      html.match(/href="\/app\/explore\/editions\/edition-1"/g) ?? [];
    expect(links).toHaveLength(editionId ? 4 : 0);
    expect(html).not.toContain("/editions/main-entry");
    expect(html).not.toContain("/editions/undefined");
    expect(html).toContain("<button>Add</button>");
  },
);

vi.mock("./featured-read-button", () => ({
  FeaturedReadButton: () => <button>Read</button>,
}));
