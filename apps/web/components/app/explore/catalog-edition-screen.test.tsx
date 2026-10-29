import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { CatalogEditionScreen } from "./catalog-edition-screen";
import { useIsCatalogAdmin } from "@/features/explore/admin/use-is-catalog-admin";
vi.mock("@/features/explore/admin/use-edition-review-evidence", () => ({
  useEditionReviewEvidence: () => null,
}));
vi.mock("@/features/explore/admin/use-admin-copies", () => ({
  useAdminCopies: () => ({ entries: [], error: "" }),
}));
vi.mock("./catalog-reading-estimates", () => ({
  CatalogReadingEstimates: () => null,
}));
vi.mock("@/features/explore/use-catalog-location", () => ({
  useCatalogLocation: () => "edition",
}));
vi.mock("@/features/explore/use-catalog-resource", () => ({
  useCatalogResource: () => ({
    data: {
      id: "edition",
      title: "Dracula",
      language: "en",
      publisher: "Publisher",
      publishedYear: 1897,
      format: "EBOOK",
      credits: [],
      identifiers: [],
      coverImageUrl: "https://example.com/edition-cover.jpg",
      work: {
        id: "work",
        originalTitle: "Dracula",
        credits: [
          {
            role: "AUTHOR",
            creditedAs: null,
            author: { id: "author", displayName: "Bram Stoker" },
          },
        ],
      },
    },
    loading: false,
    error: false,
    stale: false,
    retry: vi.fn(),
  }),
}));
vi.mock("@/features/explore/admin/use-is-catalog-admin", () => ({
  useIsCatalogAdmin: vi.fn(),
}));
it.each([false, true])(
  "shows public edition info and gates controls for admin=%s",
  (admin) => {
    vi.mocked(useIsCatalogAdmin).mockReturnValue(admin);
    const html = renderToStaticMarkup(withIntl(<CatalogEditionScreen />));
    expect(html).toContain("Bram Stoker");
    expect(html).toContain("About work");
    expect(html).toContain("edition-cover.jpg");
    expect(html).toContain('data-reading-edition="edition"');
    expect(html).toContain("Publisher");
    expect(html).toContain("1897");
    expect(html).toContain('href="/app/explore/books/work?');
    expect(html.includes("Edit edition")).toBe(admin);
    expect(html.includes("Change work")).toBe(admin);
  },
);

vi.mock("@/features/explore/use-reading-details", () => ({
  useReadingDetails: () => null,
}));

vi.mock("./admin/catalog-admin-reading", () => ({
  CatalogAdminReading: ({ editionId }: { editionId: string }) => (
    <div data-reading-edition={editionId}>
      <button>Read</button>
      <button>Listen</button>
    </div>
  ),
}));
