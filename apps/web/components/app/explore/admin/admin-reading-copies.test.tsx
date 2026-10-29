import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AdminReadingCopies } from "./admin-reading-copies";
vi.mock("@/features/explore/admin/use-admin-copies", () => ({
  useAdminCopies: () => ({
    entries: [
      { id: "a", editionId: "first", status: "DRAFT" },
      { id: "b", editionId: "second", status: "DRAFT" },
    ],
    error: "",
  }),
}));
vi.mock("./admin-reading-copy", () => ({
  AdminReadingCopy: ({ entry }: { entry: { editionId: string } }) => (
    <button>{entry.editionId}</button>
  ),
}));
vi.mock("../catalog-reading-assets", () => ({
  CatalogReadingAssets: () => null,
}));
it("never offers another edition’s preview on an edition page", () => {
  const html = renderToStaticMarkup(
    <AdminReadingCopies workId="work" editionId="first" />,
  );
  expect(html).toContain(">first</button>");
  expect(html).not.toContain(">second</button>");
});
it("retains all edition previews on a work page", () => {
  const html = renderToStaticMarkup(<AdminReadingCopies workId="work" />);
  expect(html).toContain(">first</button>");
  expect(html).toContain(">second</button>");
});
