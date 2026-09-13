import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Locale } from "@/i18n/locales";
import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import frMessages from "@/i18n/messages/fr.json";
import ptBrMessages from "@/i18n/messages/pt-BR.json";
import ukMessages from "@/i18n/messages/uk.json";

import { StatNumber } from "./stat-number";

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  de: deMessages,
  "pt-BR": ptBrMessages,
  uk: ukMessages,
};

const render = (value: number, locale: Locale = "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={messagesByLocale[locale]}
      timeZone="UTC"
    >
      <StatNumber value={value} />
    </NextIntlClientProvider>,
  );

const visibleText = (html: string) =>
  html.match(/<span\b[^>]*aria-hidden="true"[^>]*>([^<]*)<\/span>/)?.[1];

describe("StatNumber", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1_000, "1k"],
    [1_200, "1k"],
    [1_999, "1k"],
    [999_999, "999k"],
    [1_000_000, "1M"],
    [1_200_000, "1M"],
    [1_999_999, "1M"],
    [2_000_000, "2M"],
  ])("displays %i as %s without rounding up", (value, expected) => {
    expect(visibleText(render(value))).toBe(expected);
  });

  it.each([
    ["en", "1k", "1M"],
    ["es", "1\u00a0mil", "1\u00a0M"],
    ["fr", "1\u00a0k", "1\u00a0M"],
    ["de", "1\u00a0Tsd.", "1\u00a0Mio."],
    ["pt-BR", "1\u00a0mil", "1\u00a0mi"],
    ["uk", "1\u00a0тис.", "1\u00a0млн"],
  ] as const)(
    "uses localized whole-number abbreviations for %s",
    (locale, thousands, millions) => {
      expect(visibleText(render(1_200, locale))).toBe(thousands);
      expect(visibleText(render(1_200_000, locale))).toBe(millions);
    },
  );

  it.each([
    ["en", "1,200"],
    ["es", "1200"],
  ] as const)(
    "retains the exact localized %s value in the tooltip and screen-reader text",
    (locale, fullValue) => {
      const html = render(1_200, locale);

      expect(html).toContain(`title="${fullValue}"`);
      expect(html).toMatch(
        new RegExp(
          `<span\\b[^>]*class="[^"]*\\bsr-only\\b[^"]*"[^>]*>${fullValue}<\\/span>`,
        ),
      );
    },
  );
});
