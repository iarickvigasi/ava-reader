import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReaderCoverLoadingContext } from "@/features/reader/reader-cover-loading-context";
import { ReaderLoadingCover } from "./reader-loading-cover";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/app/core/reader-ui-context", () => ({
  useReaderUi: () => ({ isPhone: false }),
}));

describe("reader loading after opening", () => {
  it("shows text shapes without a cover while the next chapter is loading", () => {
    const markup = renderToStaticMarkup(
      <ReaderCoverLoadingContext
        value={{ opening: false, reportLoading: vi.fn() }}
      >
        <ReaderLoadingCover loading />
      </ReaderCoverLoadingContext>,
    );
    expect(markup).toContain("data-reader-text-skeleton");
    expect(markup).toContain("motion-safe:animate-pulse");
    expect(markup).not.toContain("data-reader-loading-cover");
    expect(markup).not.toContain("<img");
  });

  it("keeps chapter placeholders out of settled pages and the initial cover handoff", () => {
    for (const [opening, loading] of [
      [false, false],
      [true, true],
    ]) {
      const markup = renderToStaticMarkup(
        <ReaderCoverLoadingContext value={{ opening, reportLoading: vi.fn() }}>
          <ReaderLoadingCover loading={loading} />
        </ReaderCoverLoadingContext>,
      );
      expect(markup).toBe("");
    }
  });
});
