import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import uk from "@/i18n/messages/uk.json";
import { withIntl } from "@/lib/test-utils/intl";
import type {
  CatalogEditionDetail,
  CatalogReadingAsset,
} from "@/lib/catalog-types";
import { EditionSourceInformation } from "./edition-source-information";
import { useEditionReviewEvidence } from "@/features/explore/admin/use-edition-review-evidence";
vi.mock("@/features/explore/admin/use-edition-review-evidence");
function Source({
  edition,
}: Parameters<typeof EditionSourceInformation>[0] & {
  edition: Partial<CatalogEditionDetail>;
}) {
  vi.mocked(useEditionReviewEvidence).mockReturnValue(
    edition as CatalogEditionDetail,
  );
  return <EditionSourceInformation edition={edition} />;
}
import { edition } from "./edition-source-fixture";
it("shows source links and research as pending instead of an approval", () => {
  const html = renderToStaticMarkup(withIntl(<Source edition={edition} />));
  expect(html).toContain("Standard Ebooks");
  expect(html).toContain('href="https://standardebooks.org/book.epub"');
  expect(html).toContain("Exact EPUB rights and quality review pending");
  expect(html).toContain("EU: ordinary copyright term");
  expect(html).toContain("1817");
  expect(html).not.toContain(">eu-term<");
});
it("only displays approved territories for an approval of the same file hash", () => {
  const asset = {
    checksum: "other",
    rightsJurisdiction: "Approved scope",
    rightsUrl: "https://example.org",
    rightsStatement: "Reviewed edition",
  } as CatalogReadingAsset;
  const render = (asset: CatalogReadingAsset) =>
    renderToStaticMarkup(
      withIntl(<Source edition={{ ...edition, readingAssets: [asset] }} />),
    );
  expect(render(asset)).not.toContain("Approved scope");
  expect(render({ ...asset, checksum: "hash" })).toContain("Approved scope");
});
it("localizes source metadata and keeps metadata-only editions empty", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="uk" messages={uk}>
      <Source edition={edition} />
    </NextIntlClientProvider>,
  );
  expect(html).toContain("Джерело EPUB");
  expect(html).toContain("ЄС: загальний строк авторського права");
  expect(renderToStaticMarkup(withIntl(<Source edition={{}} />))).toBe("");
});

it("keeps deferred publications pending until an exact-file review is completed", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <Source
        edition={{
          ...edition,
          readingAssets: [
            {
              checksum: "hash",
              reviewDeferred: true,
              rightsJurisdiction: "Not reviewed",
              rightsStatement: "Not approved",
            } as CatalogReadingAsset,
          ],
        }}
      />,
    ),
  );
  expect(html).toContain("Exact EPUB rights and quality review pending");
  expect(html).not.toContain("Not reviewed");
});

it("hides inspection and research from non-admins even if old cached metadata contains them", () => {
  vi.mocked(useEditionReviewEvidence).mockReturnValue(null);
  const html = renderToStaticMarkup(
    withIntl(<EditionSourceInformation edition={edition} />),
  );
  expect(html).toContain("Standard Ebooks");
  expect(html).not.toContain("1817");
  expect(html).not.toContain("review pending");
  expect(html).not.toContain("2026");
});
