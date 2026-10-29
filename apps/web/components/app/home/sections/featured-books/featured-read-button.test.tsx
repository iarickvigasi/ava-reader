import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { useCatalogRead } from "@/features/explore/use-catalog-read";
import { FeaturedReadButton } from "./featured-read-button";

vi.mock("@/features/explore/use-catalog-read", () => ({
  useCatalogRead: vi.fn(),
}));

it.each([
  { pending: false, error: false },
  { pending: true, error: false },
  { pending: false, error: true },
])("uses catalog reading with pending/error feedback (%j)", (state) => {
  vi.mocked(useCatalogRead).mockReturnValue({ ...state, read: vi.fn() });
  const html = renderToStaticMarkup(
    withIntl(<FeaturedReadButton entryId="public-entry" />),
  );
  expect(useCatalogRead).toHaveBeenCalledWith("public-entry");
  expect(html).toContain("Read");
  expect(html).toContain("/icons/navigation/library.svg");
  expect(html).toContain('aria-hidden="true"');
  expect(html.includes('disabled=""')).toBe(state.pending);
  expect(html.includes('role="alert"')).toBe(state.error);
});
