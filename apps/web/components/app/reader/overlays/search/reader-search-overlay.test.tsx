import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { withIntl } from "@/lib/test-utils/intl";
import type { SearchHit } from "@/features/reader/search/types";
import { ReaderSearchOverlay } from "./reader-search-overlay";
const model = vi.hoisted(() => ({
  query: "",
  loading: false,
  pending: false,
  error: false,
  results: { hits: [] as SearchHit[], truncated: false },
  setQuery: vi.fn(),
  retry: vi.fn(),
}));
vi.mock("@/features/reader/search/use-reader-search", () => ({
  useReaderSearch: () => model,
}));
const render = () =>
  renderToStaticMarkup(
    withIntl(
      <ReaderSearchOverlay
        payload={canonicalFixture()}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    ),
  );
describe("search communication", () => {
  beforeEach(() => {
    Object.assign(model, {
      query: "",
      loading: false,
      pending: false,
      error: false,
      results: { hits: [], truncated: false },
    });
  });
  it("offers an explicitly labelled input and desktop close with an initial hint", () => {
    const html = render();
    expect(html).toContain('aria-label="Close search"');
    expect(html).toContain("Search this book");
    expect(html).toContain("Enter a word or phrase.");
    expect(html).not.toContain("No matches");
  });
  it("distinguishes complete no-match, incomplete loading and unavailable content", () => {
    model.query = "missing";
    expect(render()).toContain("No matches");
    model.loading = true;
    expect(render()).toContain("Searching…");
    expect(render()).not.toContain("No matches");
    model.loading = false;
    model.error = true;
    expect(render()).toContain("The whole book is not available for search.");
    expect(render()).toContain("Try again");
    expect(render()).not.toContain("No matches");
  });
  it("labels the result limit instead of claiming a full count", () => {
    model.query = "word";
    model.results = { hits: [], truncated: true };
    expect(render()).toContain("Refine your search.");
  });
  it("renders original source as escaped text, including chapter labels", () => {
    model.query = "script";
    model.results.hits = [
      {
        chapterId: "one",
        blockId: "body",
        chapterLabel: "<img onerror=alert(1)>",
        text: "before <script>alert(1)</script> after",
        textOffset: 8,
        endOffset: 14,
      },
    ];
    const html = render();
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<mark");
  });
});
