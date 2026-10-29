import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import type { HomePayload } from "@/lib/api-types";
import { HomeFeaturedWithCache } from "./home-featured-with-cache";
import { useHomeWithCache } from "@/features/offline/buckets/home/hooks";

vi.mock("@/features/offline/buckets/home/hooks", () => ({
  useHomeWithCache: vi.fn(),
}));
vi.mock("@/components/app/shared/book-cover", () => ({
  BookCover: ({ title }: { title: string }) => <span>{title} cover</span>,
}));
vi.mock("./featured-books/catalog-add-button", () => ({
  CatalogAddButton: () => <button>Add</button>,
}));

it("updates stale featured cards with edition links from the refreshed Home cache", () => {
  const entry = {
    id: "main-entry",
    title: "Emma",
    authors: [],
    description: null,
    coverImageUrl: null,
    primaryFormat: "EPUB",
    isFeatured: true,
  } as const;
  const initial = {
    featuredCatalog: { entries: [{ ...entry, authors: [] }] },
  } as unknown as HomePayload;
  vi.mocked(useHomeWithCache).mockReturnValue(initial);
  const render = () =>
    renderToStaticMarkup(withIntl(<HomeFeaturedWithCache home={initial} />));
  expect(render()).not.toContain("/editions/");
  vi.mocked(useHomeWithCache).mockReturnValue({
    ...initial,
    featuredCatalog: {
      entries: [{ ...entry, authors: [], editionId: "mapped-edition" }],
    },
  });
  expect(
    render().match(/href="\/app\/explore\/editions\/mapped-edition"/g),
  ).toHaveLength(4);
});

vi.mock("./featured-books/featured-read-button", () => ({
  FeaturedReadButton: () => <button>Read</button>,
}));
