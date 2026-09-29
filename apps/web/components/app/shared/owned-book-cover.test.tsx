import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { BookCover } from "./book-cover";
vi.mock("./owned-cover-source", () => ({
  OwnedCoverSource: ({
    libraryItemId,
    children,
  }: {
    libraryItemId: string | null;
    children: (src: string | null) => ReactNode;
  }) => children(libraryItemId ? "blob:authenticated-cover" : null),
}));
it("renders only the authenticated blob instead of putting an owned URL in an img", () => {
  const markup = renderToStaticMarkup(
    <BookCover
      alt="Cover"
      title="Book"
      libraryItemId="library"
      src="/api/library/epub-imports/covers/library"
    />,
  );
  expect(markup).toContain('src="blob:authenticated-cover"');
  expect(markup).not.toContain("/api/library/epub-imports/");
});
it("shows a placeholder if the owned cover does not match this Library item", () => {
  const markup = renderToStaticMarkup(
    <BookCover
      alt="Cover"
      title="Book"
      libraryItemId="other"
      src="/api/library/epub-imports/covers/library"
    />,
  );
  expect(markup).not.toContain("<img");
  expect(markup).toContain("Book");
});
