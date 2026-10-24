import { expect, it } from "vitest";
import { catalogHref, exploreReturn } from "./explore-return";

it("preserves a query through book and author navigation", () => {
  const start = "/app/explore?q=Alice&languages=en&filters=fantasy";
  const book = catalogHref("/app/explore/books/book", exploreReturn(start));
  const author = catalogHref(
    "/app/explore/authors/author",
    exploreReturn(book),
  );
  expect(exploreReturn(author)).toBe(start);
});
it.each([
  "https://evil.invalid",
  "//evil.invalid",
  "/app/explore/books/book",
  "/app/explore/../admin",
  "/app/explore?" + "x".repeat(3000),
])("rejects unsafe or invalid return destinations: %s", (returnTo) => {
  expect(
    exploreReturn(
      `/app/explore/books/book?${new URLSearchParams({ returnTo })}`,
    ),
  ).toBe("/app/explore");
});
