import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import type { ReaderBookPayload } from "@/lib/api-types/reader";
import { ReaderDownloadOverlay } from "./reader-download-overlay";

const state = vi.hoisted(() => ({ online: true, pending: false, failed: false }));
vi.mock("@/features/offline/net/use-network-state", () => ({ useNetworkState: () => state.online }));
vi.mock("@/features/library/downloads/use-book-download", () => ({ useBookDownload: () => ({ ...state, download: vi.fn() }) }));
const render = (format: ReaderBookPayload["primaryFormat"] = "PDF") => renderToStaticMarkup(withIntl(
  <ReaderDownloadOverlay book={{ ...canonicalFixture().book, primaryFormat: format }} onClose={() => {}} />,
));
beforeEach(() => Object.assign(state, { online: true, pending: false, failed: false }));

it("offers existing EPUB and original PDF files for a readable converted book", () => {
  const html = render();
  expect(html).toContain('aria-label="Download book"');
  expect(html).toContain('aria-label="Close downloads"');
  expect(html).toContain('>EPUB</button>');
  expect(html).toContain('>Original PDF</button>');
  expect(html).not.toContain("Convert");
  expect(render("EPUB")).not.toContain('>Original PDF</button>');
});

it("explains offline and unavailable downloads without a dead control", () => {
  state.online = false;
  const html = render();
  expect(html).toContain("Connect to download this book.");
  expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  expect(render("UNKNOWN")).toContain("No downloadable format is available.");
  expect(render("UNKNOWN")).not.toContain('>EPUB</button>');
});

it("distinguishes a pending transfer from a retryable failure", () => {
  state.pending = true;
  expect(render()).toContain("Downloading…");
  expect(render()).toContain('aria-busy="true"');
  state.pending = false; state.failed = true;
  expect(render()).toContain('role="alert"');
  expect((render().match(/disabled=""/g) ?? []).length).toBe(0);
});
