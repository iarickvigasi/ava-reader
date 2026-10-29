import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import type { CatalogWork } from "@/lib/catalog-types";
import { CatalogAdminReading } from "./admin/catalog-admin-reading";
import { CatalogBookReading } from "./catalog-book-reading";
vi.mock("./admin/catalog-admin-reading", () => ({
  CatalogAdminReading: vi.fn(() => <button>Read</button>),
}));
it("links the selected edition to the left of Read", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <CatalogBookReading
        work={{ id: "work" } as CatalogWork}
        editionId="edition"
      />,
    ),
  );
  expect(vi.mocked(CatalogAdminReading).mock.calls.at(-1)?.[0]).toMatchObject({
    editionId: "edition",
  });
  expect(html).toContain('href="/app/explore/editions/edition?');
  expect(html.indexOf("Edition details")).toBeLessThan(
    html.indexOf(">Read</button>"),
  );
});
it("does not create a broken edition link for a work with no editions", () => {
  const html = renderToStaticMarkup(
    withIntl(<CatalogBookReading work={{ id: "work" } as CatalogWork} />),
  );
  expect(html).not.toContain("/app/explore/editions/");
});
