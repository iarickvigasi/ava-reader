import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LibraryCollectionPlaceholderPage } from "./library-collection-placeholder-page";

describe("library collection placeholder UI", () => {
  it("renders mobile two-column grid and keeps desktop grid unchanged", () => {
    const markup = renderToStaticMarkup(<LibraryCollectionPlaceholderPage />);

    expect(markup).toContain('class="grid grid-cols-2 gap-x-4 gap-y-6 md:hidden"');
    expect(markup).not.toContain('class="flex gap-4 overflow-x-auto pb-2 md:hidden"');
    expect(markup).toContain(
      'class="hidden gap-x-8 gap-y-6 md:grid md:grid-cols-3 xl:grid-cols-4"',
    );
  });
});
