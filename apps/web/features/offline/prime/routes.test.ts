import { describe, expect, it } from "vitest";

import type { LibraryView } from "../buckets/library/types";

import { STATIC_APP_ROUTES, collectAppRoutes } from "./routes";

function view(
  collections: Array<{
    slug: string;
    kind: "SMART" | "CUSTOM";
    bookSlugs: string[];
  }>,
): LibraryView {
  return {
    collections: collections.map((c) => ({
      slug: c.slug,
      kind: c.kind,
      books: c.bookSlugs.map((slug) => ({ libraryItemId: slug, slug })),
    })),
    summary: { booksCount: 0, collectionsCount: collections.length },
  } as unknown as LibraryView;
}

describe("collectAppRoutes", () => {
  it("returns only the static app routes when there is no library view", () => {
    expect(collectAppRoutes(null)).toEqual([...STATIC_APP_ROUTES]);
  });

  it("adds book-info, reader, and collection routes from the view", () => {
    const routes = collectAppRoutes(
      view([{ slug: "all", kind: "SMART", bookSlugs: ["dune", "1984"] }]),
    );
    expect(routes).toEqual([
      ...STATIC_APP_ROUTES,
      "/app/library/collections/all",
      "/app/library/books/dune",
      "/app/read/dune",
      "/app/library/books/1984",
      "/app/read/1984",
    ]);
  });

  it("dedupes a book that appears in more than one smart collection", () => {
    const routes = collectAppRoutes(
      view([
        { slug: "imported", kind: "SMART", bookSlugs: ["dune"] },
        { slug: "catalog", kind: "SMART", bookSlugs: ["dune"] },
      ]),
    );
    expect(routes.filter((r) => r === "/app/read/dune")).toHaveLength(1);
    expect(routes.filter((r) => r === "/app/library/books/dune")).toHaveLength(1);
  });

  it("includes custom-collection routes but not their books twice", () => {
    const routes = collectAppRoutes(
      view([
        { slug: "smart", kind: "SMART", bookSlugs: ["dune"] },
        { slug: "fav", kind: "CUSTOM", bookSlugs: ["dune"] },
      ]),
    );
    expect(routes).toContain("/app/library/collections/fav");
    expect(routes.filter((r) => r === "/app/read/dune")).toHaveLength(1);
  });
});
