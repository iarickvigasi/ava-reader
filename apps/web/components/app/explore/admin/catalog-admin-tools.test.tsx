import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import uk from "@/i18n/messages/uk.json";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { CatalogAdminTools } from "./catalog-admin-tools";
import { useIsCatalogAdmin } from "@/features/explore/admin/use-is-catalog-admin";
vi.mock("@/features/explore/admin/use-is-catalog-admin", () => ({
  useIsCatalogAdmin: vi.fn(),
}));
vi.mock("@/features/explore/admin/use-admin-copies", () => ({
  useAdminCopies: () => ({
    entries: [
      {
        id: "copy",
        editionId: "edition",
        status: "DRAFT",
        processingStatus: "READY",
        syncPending: false,
      },
    ],
    error: "",
  }),
}));
beforeEach(() => vi.mocked(useIsCatalogAdmin).mockReturnValue(false));
it("keeps editorial actions out of the ordinary user view", () => {
  expect(
    renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <CatalogAdminTools kind="works" id="work" />
      </NextIntlClientProvider>,
    ),
  ).toBe("");
});
it("adds Publish, Edit, and Delete to the shared book UI for admins", () => {
  vi.mocked(useIsCatalogAdmin).mockReturnValue(true);
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <CatalogAdminTools kind="works" id="work" />
    </NextIntlClientProvider>,
  );
  expect(html).toContain("Publish");
  expect(html).toContain("Edit book");
  expect(html).toContain("Delete book");
  expect(html).toContain("font-reader");
  expect(html).toContain("text-danger");
  expect(html).toContain("existing readers keep their copies");
  const author = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <CatalogAdminTools kind="authors" id="author" />
    </NextIntlClientProvider>,
  );
  expect(author).toContain("Edit author");
  expect(author).not.toContain("Delete book");
});

it("localizes admin action titles and descriptions in Ukrainian", () => {
  vi.mocked(useIsCatalogAdmin).mockReturnValue(true);
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="uk" messages={uk}>
      <CatalogAdminTools kind="works" id="work" />
    </NextIntlClientProvider>,
  );
  expect(html).toContain("Редагувати книгу");
  expect(html).toContain("Опублікувати");
  expect(html).toContain("Видалити книгу");
  expect(html).toContain("Приєднати видання");
  expect(html).toContain("Зробити цей примірник доступним для всіх");
  expect(html).not.toContain("Edit book");
});
