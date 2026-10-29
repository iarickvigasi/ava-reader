import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import uk from "@/i18n/messages/uk.json";
import type { ReadingReview } from "@/lib/api-types/reading-review";
import { PublicationActions } from "./publication-actions";
function render(status: ReadingReview["status"], locale = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "uk" ? uk : en}
    >
      <PublicationActions
        entry={{ status } as ReadingReview}
        pending={false}
        close={() => undefined}
      />
    </NextIntlClientProvider>,
  );
}
it("offers deferred publication without demanding completed-review fields", () => {
  const html = render("DRAFT");
  expect(html).toContain('value="defer"');
  expect(html).toContain("formNoValidate");
  expect(html).toContain("Publish now, review later");
});
it("allows unpublishing and saving a completed review after publication", () => {
  const html = render("PUBLISHED");
  expect(html).toContain('value="unpublish"');
  expect(html).toContain("Save completed review");
  expect(html).not.toContain('value="defer"');
});
it("localizes publication and restoration actions", () => {
  expect(render("ARCHIVED", "uk")).toContain(
    "Опублікувати зараз, перевірити пізніше",
  );
});
