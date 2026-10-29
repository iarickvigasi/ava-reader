import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import type { CatalogWork } from "@/lib/catalog-types";
import { useCatalogBook } from "@/features/explore/use-catalog-book";
import { CatalogBookScreen } from "./catalog-book-screen";
import { BookDescription } from "@/components/app/shared/books/book-description";

vi.mock("@/features/explore/use-catalog-book", () => ({
  useCatalogBook: vi.fn(),
}));
vi.mock("./catalog-book-hero", () => ({ CatalogBookHero: () => null }));

const work: CatalogWork = {
  id: "work",
  originalTitle: "Book",
  originalLanguage: null,
  credits: [],
  texts: [],
};
const state: ReturnType<typeof useCatalogBook> = {
  work: {
    data: work,
    loading: false,
    error: false,
    stale: false,
    retry: vi.fn(),
  },
  editions: {
    data: { items: [], nextCursor: null },
    loading: false,
    error: false,
    stale: false,
    retry: vi.fn(),
  },
  selectedEdition: undefined,
};

beforeEach(() => {
  work.texts = [];
  state.work.data = work;
  state.work.loading = false;
  state.editions.loading = false;
  state.editions.error = false;
  vi.mocked(useCatalogBook).mockReturnValue(state);
});

it("omits empty description and edition sections on catalog pages", () => {
  const html = renderToStaticMarkup(withIntl(<CatalogBookScreen />));
  expect(html).not.toContain("<h2");
  expect(html).not.toContain("No description");
});

it("keeps edition failures retryable without an empty Editions heading", () => {
  state.editions.error = true;
  const html = renderToStaticMarkup(withIntl(<CatalogBookScreen />));
  expect(html).toContain("Retry");
  expect(html).not.toContain("<h2");
});

it("shows a real description and preserves Library's default fallback", () => {
  work.texts = [{ locale: "en", description: "A real description." }];
  expect(renderToStaticMarkup(withIntl(<CatalogBookScreen />))).toContain(
    "A real description.",
  );
  expect(
    renderToStaticMarkup(withIntl(<BookDescription description={null} />)),
  ).toContain("<h2");
  expect(
    renderToStaticMarkup(
      withIntl(<BookDescription hideWhenEmpty description="<p> </p>" />),
    ),
  ).toBe("");
});

it("shows a skeleton while the work loads", () => {
  state.work.loading = true;
  state.work.data = null;
  const html = renderToStaticMarkup(withIntl(<CatalogBookScreen />));
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("Loading book details");
  expect(html).not.toContain("Loading books");
});

vi.mock("@/features/explore/use-reading-details", () => ({
  useReadingDetails: () => null,
}));
vi.mock("./admin/catalog-admin-tools", () => ({
  CatalogAdminTools: () => null,
}));
vi.mock("./linking/link-private-copy", () => ({ LinkPrivateCopy: () => null }));
