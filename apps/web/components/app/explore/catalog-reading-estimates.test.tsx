import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { CatalogReadingEstimates } from "./catalog-reading-estimates";
it("uses body pages for total reading time and full pages for page count", () => {
  const estimates = {
    approximatePageCount: 565,
    approximateBodyPageCount: 540,
    description: null,
  };
  const html = renderToStaticMarkup(
    withIntl(<CatalogReadingEstimates estimates={estimates} />),
  );
  expect(html).toContain("18.0");
  expect(html).toContain("565");
  expect(html).not.toContain("0.0");
});
it("shows unknown estimates instead of inventing a count for metadata-only books", () => {
  const html = renderToStaticMarkup(
    withIntl(<CatalogReadingEstimates estimates={null} />),
  );
  expect(html).toContain("Unknown");
  expect(html).not.toContain("0.0");
});
