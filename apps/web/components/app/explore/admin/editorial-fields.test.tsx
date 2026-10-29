import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import uk from "@/i18n/messages/uk.json";
import { EditorialFields } from "./editorial-fields";
import { EditorialProvenance } from "./editorial-provenance";
vi.mock("./credit-fields", () => ({ CreditFields: () => null }));
it("localizes edition fields and identifiers while preserving their values", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="uk" messages={uk}>
      <EditorialFields
        kind="editions"
        data={{
          title: "Emma",
          language: "en",
          format: "EBOOK",
          credits: [],
          identifiers: [
            { scheme: "ISBN_13", normalizedValue: "9780000000000" },
          ],
        }}
        change={vi.fn()}
      />
      <EditorialProvenance
        record={{ id: "edition", revision: 2, sourceMappings: [] }}
      />
    </NextIntlClientProvider>,
  );
  for (const label of [
    "Назва",
    "Код мови",
    "Видавництво",
    "Рік видання",
    "Ідентифікатори",
    "Додати запис",
    "Інформація про джерело",
    "Версія 2",
  ])
    expect(html).toContain(label);
  expect(html).toContain('value="EBOOK" selected=""');
  expect(html).toContain("Електронна книга");
  expect(html).toContain('value="Emma"');
  expect(html).toContain('value="ISBN_13"');
  expect(html).not.toContain("Cover image URL");
});
