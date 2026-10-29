import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import type { ReadingReview } from "@/lib/api-types/reading-review";
import { useAdminCopies } from "@/features/explore/admin/use-admin-copies";
import { CatalogPublicationControl } from "./catalog-publication-control";
vi.mock("@/features/explore/admin/use-admin-copies");
const copy = {
  id: "copy",
  editionId: "edition",
  title: "Emma",
  language: "en",
  filename: "emma.epub",
  status: "DRAFT",
  processingStatus: "READY",
  syncPending: false,
} as ReadingReview;
const render = () =>
  renderToStaticMarkup(withIntl(<CatalogPublicationControl workId="work" />));
beforeEach(() =>
  vi.mocked(useAdminCopies).mockReturnValue({ entries: [copy], error: "" }),
);
it("switches from Publish to Unpublish and explains the new state after refresh", () => {
  const draft = render();
  expect(draft).toContain(">Publish<");
  expect(draft).toContain("Not available in Explore");
  vi.mocked(useAdminCopies).mockReturnValue({
    entries: [{ ...copy, status: "PUBLISHED" }],
    error: "",
  });
  const published = render();
  expect(published).toContain(">Unpublish<");
  expect(published).toContain("existing readers keep access");
  expect(published).not.toContain(">Publish<");
});
it("keeps separate states for different files of the same work", () => {
  vi.mocked(useAdminCopies).mockReturnValue({
    entries: [
      copy,
      { ...copy, id: "second", status: "PUBLISHED", filename: "second.epub" },
    ],
    error: "",
  });
  expect(render()).toContain(">Publish<");
  expect(render()).toContain(">Unpublish<");
  expect(render()).toContain("second.epub");
});
it("restricts edition controls to its files and disables unfinished imports", () => {
  const html = renderToStaticMarkup(
    withIntl(<CatalogPublicationControl workId="work" editionId="other" />),
  );
  expect(html).toContain("disabled");
  expect(html).toContain("Import and process a readable file");
});
it("explains pending synchronization instead of claiming availability", () => {
  vi.mocked(useAdminCopies).mockReturnValue({
    entries: [{ ...copy, status: "PUBLISHED", syncPending: true }],
    error: "",
  });
  expect(render()).toContain("still syncing");
});
