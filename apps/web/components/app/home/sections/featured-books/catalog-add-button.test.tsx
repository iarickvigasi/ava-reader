import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { useFeaturedAdd } from "@/features/home/use-featured-add";
import { CatalogAddButton } from "./catalog-add-button";

vi.mock("@/features/home/use-featured-add", () => ({
  useFeaturedAdd: vi.fn(),
}));

it.each([true, false])(
  "reflects persisted membership without another Add request (%s)",
  (present) => {
    vi.mocked(useFeaturedAdd).mockReturnValue({
      present,
      pending: false,
      error: false,
      add: vi.fn(),
    });
    const html = renderToStaticMarkup(
      withIntl(<CatalogAddButton entryId="entry" libraryItemId="lib-1" />),
    );
    expect(useFeaturedAdd).toHaveBeenCalledWith("entry", "lib-1");
    expect(html).toContain(present ? "In library" : "Add to library");
    expect(html.includes('disabled=""')).toBe(present);
  },
);
