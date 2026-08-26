import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createReaderResumeFixturePayload } from "@/features/reader/test-fixture";
import { withIntl } from "@/lib/test-utils/intl";
import { READER_STATUS_READY } from "../../shared/constants";
import { ReaderContentsOverlay } from "./reader-contents-overlay";

function renderOverlayMarkup(): string {
  const payload = createReaderResumeFixturePayload();
  if (payload.status !== READER_STATUS_READY) {
    throw new Error("fixture payload must be ready");
  }
  return renderToStaticMarkup(
    withIntl(
      <ReaderContentsOverlay
        activeChapterId={payload.activeChapterId}
        activeLocator={null}
        onClose={() => {}}
        onSelectChapter={() => {}}
        payload={payload}
        pendingChapterId={null}
      />,
    ),
  );
}

describe("ReaderContentsOverlay", () => {
  it("pins only the slim header: every close control precedes the scroll container", () => {
    const markup = renderOverlayMarkup();
    const scrollStart = markup.indexOf("overflow-auto");

    expect(scrollStart).toBeGreaterThan(-1);
    expect(markup.lastIndexOf("overflow-auto")).toBe(scrollStart);
    expect(markup.lastIndexOf("Close contents panel")).toBeLessThan(scrollStart);
  });

  it("scrolls the book title, authors, and progress together with the chapter tree", () => {
    const markup = renderOverlayMarkup();
    const scrollStart = markup.indexOf("overflow-auto");

    expect(markup.indexOf("Reader Resume Fixture")).toBeGreaterThan(scrollStart);
    expect(markup.indexOf("Fixture Author")).toBeGreaterThan(scrollStart);
    expect(markup.indexOf("% completed")).toBeGreaterThan(scrollStart);
    expect(markup.indexOf("Fixture Chapter 1")).toBeGreaterThan(scrollStart);
  });
});
