import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import { DevelopersSection } from "./developers-section";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import fr from "@/i18n/messages/fr.json";
import de from "@/i18n/messages/de.json";
import pt from "@/i18n/messages/pt-BR.json";
import uk from "@/i18n/messages/uk.json";

it("omits the section for old caches and no configured contacts", () => {
  expect(
    renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <DevelopersSection />
      </NextIntlClientProvider>,
    ),
  ).toBe("");
});
it.each([en, es, fr, de, pt, uk])(
  "localizes the contact section and links safely",
  (messages) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DevelopersSection
          developers={[
            {
              id: "u",
              displayName: "Ada",
              avatarUrl: null,
              telegramUrl: "https://t.me/ava_dev",
            },
          ]}
        />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(messages.home.developers.title);
    expect(html).toContain(messages.home.developers.subtitle);
    expect(html).toContain('href="https://t.me/ava_dev"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">A</span>");
  },
);
