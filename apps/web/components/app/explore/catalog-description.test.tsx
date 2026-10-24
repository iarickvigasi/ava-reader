import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { CatalogDescription } from "./catalog-description";

it("falls back to an actual description and offers only nonempty language variants", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <CatalogDescription
        texts={[
          { locale: "en", title: "Title only" },
          { locale: "uk", description: "Український опис" },
          { locale: "fr", description: "Un livre." },
          { locale: "de", description: "<p> </p>" },
        ]}
      />,
    ),
  );
  expect(html).toContain("Український опис");
  expect(html).toContain("Ukrainian");
  expect(html).toContain("French");
  expect(html).not.toContain("German");
  expect(html).not.toContain("English");
  expect(html).toContain('aria-pressed="true"');
});

it("hides the language label for a sole undetermined description", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <CatalogDescription
        texts={[{ locale: "und", description: "An imported description." }]}
      />,
    ),
  );
  expect(html).not.toContain("Unspecified language");
  expect(html).not.toContain("<button");
  expect(html).toContain("An imported description.");
  expect(html).not.toContain(">root<");
});

it("shows a single known description language as plain text", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <CatalogDescription
        texts={[{ locale: "en", description: "A description." }]}
      />,
    ),
  );
  expect(html).toContain("English");
  expect(html).not.toContain("<button");
});
