import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { BookDescription } from "@/components/app/shared/books/book-description";
import { ExploreFilters } from "./explore-filters";
import { BookAuthors } from "@/components/app/shared/books/book-authors";

it("exposes independently active pills and a separate language group", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <ExploreFilters
        filters={["readable"]}
        languages={["en", "uk"]}
        available={["en", "fr", "uk"]}
        toggle={() => undefined}
      />,
    ),
  );
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
  expect(html.match(/role="group"/g)).toHaveLength(2);
  expect(html).not.toContain("Has description");
  expect(html).not.toContain("Has ISBN");
  expect(html).not.toContain("E-book edition");
  expect(html).toContain("Fantasy");
  expect(html).toContain("Nonfiction");
  expect(html).toContain("overflow-x-auto");
  expect(html).toContain("English");
  expect(html).toContain("Ukrainian");
});

it("links known catalog authors while preserving plain private-import names", () => {
  const html = renderToStaticMarkup(
    <BookAuthors
      authors={[{ id: "author-id", name: "Known" }, { name: "Private" }]}
    />,
  );
  expect(html).toContain("/app/explore/authors/author-id");
  expect(html.match(/<a /g)).toHaveLength(1);
  expect(html).toContain("Private");
});

it("uses a neutral catalog fallback rather than claiming the user owns the book", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <BookDescription
        description={null}
        fallbackText="No description available."
      />,
    ),
  );
  expect(html).toContain("No description available.");
  expect(html).not.toContain("in your library");
});
