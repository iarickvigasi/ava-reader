import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { LibraryPayload } from "@/lib/api-types";
import { withIntl } from "@/lib/test-utils/intl";
import { LibraryScreen } from "./library-screen";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: async () => "token",
    isLoaded: true,
    isSignedIn: true,
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function fixture(): LibraryPayload {
  const book = {
    libraryItemId: "general",
    slug: "general",
    title: "Uncollected title",
    authors: [],
    coverImageUrl: null,
    completionPercent: 0,
    primaryFormat: "EPUB" as const,
    lastReadAt: "2026-10-25T00:00:00Z",
  };
  const collected = {
    ...book,
    libraryItemId: "organized",
    slug: "organized",
    title: "Organized title",
  };
  return {
    books: [book, collected],
    summary: { booksCount: 2, collectionsCount: 1 },
    collections: [
      {
        id: "custom",
        slug: "favorites",
        kind: "CUSTOM",
        smartKey: null,
        name: "Favorites",
        description: null,
        books: [collected],
        itemCount: 1,
        unreadCount: 1,
        completionItems: [
          {
            libraryItemId: "organized",
            finishedAt: null,
            completionPercent: 0,
          },
        ],
      },
    ],
  };
}

it("renders uncollected books before collections without a synthetic collection link", () => {
  const markup = renderToStaticMarkup(
    withIntl(<LibraryScreen library={fixture()} />),
  );
  expect(markup.indexOf("Uncollected title")).toBeLessThan(
    markup.indexOf("Favorites"),
  );
  expect(markup).toContain('aria-label="Books"');
  expect(markup).not.toContain("collections/general");
});

it("hides the general grid when every book is organized", () => {
  const library = fixture();
  library.collections[0].completionItems!.push({
    libraryItemId: "general",
    finishedAt: null,
    completionPercent: 0,
  });
  const markup = renderToStaticMarkup(
    withIntl(<LibraryScreen library={library} />),
  );
  expect(markup).not.toContain('aria-label="Books"');
  expect(markup).toContain("Favorites");
});

it("progressively reveals a catalog beyond the initial grid", () => {
  const library = fixture();
  library.collections = [];
  library.books = Array.from({ length: 25 }, (_, i) => ({
    ...library.books![0],
    libraryItemId: `book-${i}`,
    slug: `book-${i}`,
  }));
  const markup = renderToStaticMarkup(
    withIntl(<LibraryScreen library={library} />),
  );
  expect(markup).toContain("Show more");
  expect(markup).toContain("/books/book-23");
  expect(markup).not.toContain("/books/book-24");
});
