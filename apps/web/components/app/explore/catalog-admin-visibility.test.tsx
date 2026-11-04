import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import type { CatalogEditionDetail } from "@/lib/catalog-types";
import { CatalogEditionActions } from "./catalog-edition-actions";
import { CatalogAdminReading } from "./admin/catalog-admin-reading";
import { CatalogAdminTools } from "./admin/catalog-admin-tools";

const state = vi.hoisted(() => ({ visible: true }));
vi.mock("@/features/explore/admin/catalog-admin-visibility-context", () => ({
  useShowCatalogAdmin: () => state.visible,
}));
vi.mock("./admin/catalog-admin-actions", () => ({
  CatalogAdminActions: () => <button>Edit edition</button>,
}));
vi.mock("./admin/admin-reading-copies", () => ({
  AdminReadingCopies: () => <button>Read draft</button>,
}));
vi.mock("./catalog-reading-assets", () => ({
  CatalogReadingAssets: () => <button>Read published copy</button>,
}));

const edition = {
  id: "edition",
  language: "en",
  work: { id: "work" },
} as CatalogEditionDetail;
beforeEach(() => (state.visible = true));

it("hides and restores the editorial actions", () => {
  const tools = <CatalogAdminTools kind="editions" id="edition" />;
  expect(renderToStaticMarkup(tools)).toContain("Edit edition");
  state.visible = false;
  expect(renderToStaticMarkup(tools)).toBe("");
  state.visible = true;
  expect(renderToStaticMarkup(tools)).toContain("Edit edition");
});

it("uses public reading actions while editorial controls are hidden", () => {
  const reading = <CatalogAdminReading workId="work" />;
  expect(renderToStaticMarkup(reading)).toContain("Read draft");
  state.visible = false;
  const html = renderToStaticMarkup(reading);
  expect(html).toContain("Read published copy");
  expect(html).not.toContain("Read draft");
});

it("omits empty action sections while retaining edition descriptions", () => {
  expect(
    renderToStaticMarkup(withIntl(<CatalogEditionActions edition={edition} />)),
  ).toContain("Edit edition");
  state.visible = false;
  expect(
    renderToStaticMarkup(withIntl(<CatalogEditionActions edition={edition} />)),
  ).toBe("");
  const html = renderToStaticMarkup(
    withIntl(
      <CatalogEditionActions
        edition={edition}
        description="A public description."
      />,
    ),
  );
  expect(html).toContain("A public description.");
  expect(html).not.toContain("Edit edition");
});
