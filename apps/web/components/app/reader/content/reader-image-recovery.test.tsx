import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/i18n/messages/en.json";
import { failedResourcePayload } from "@/features/reader/canonical/resource-recovery-fixture";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { ReaderResourcesProvider } from "./reader-resources-context";
import { ReaderMeasurementContext } from "./reader-measurement-context";
import { ReaderFigure } from "./reader-figure";

vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({
    userId: "fixture-owner",
    isLoaded: true,
    isSignedIn: true,
    getToken: async () => "fixture-token",
  }),
}));
function render(missing: boolean, measurement = false) {
  const payload = missing ? failedResourcePayload() : canonicalFixture();
  const block = payload.chapters[0].blocks.find((b) => b.kind === "image")!;
  if (block.kind !== "image") throw new Error("Expected source figure");
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <ReaderResourcesProvider payload={payload}>
        <ReaderMeasurementContext value={measurement}>
          <ReaderFigure
            block={block}
            chapterId="chapter-one"
            pageHeight={700}
          />
        </ReaderMeasurementContext>
      </ReaderResourcesProvider>
    </NextIntlClientProvider>,
  );
}
describe("recoverable illustration DOM", () => {
  it("keeps declared geometry, caption association and a named real retry", () => {
    const ready = render(false),
      missing = render(true);
    for (const html of [ready, missing]) {
      expect(html).toContain('width="32"');
      expect(html).toContain('height="20"');
      expect(html).toContain('style="max-height:600px"');
      expect(html).toContain(
        'aria-describedby="reader-chapter-one-caption-one"',
      );
      expect(html).toContain('data-reader-block-kind="image"');
    }
    expect(missing).toContain("Illustration unavailable");
    expect(missing).toContain("Retry illustration");
    expect(missing).toContain('data-reader-ui="true"');
    expect(missing).not.toContain('src=""');
    expect(ready).not.toContain("Illustration unavailable");
  });
  it("uses the identical reserved image in measurement with no status/actions or duplicate source identity", () => {
    const html = render(true, true);
    expect(html).toContain('width="32"');
    expect(html).toContain('height="20"');
    expect(html).not.toContain("Retry illustration");
    expect(html).not.toContain("Illustration unavailable");
    expect(html).not.toContain('id="reader-chapter-one-figure-one"');
    expect(html).not.toContain("aria-describedby=");
  });
});
