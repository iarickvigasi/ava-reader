import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import { LibraryFeaturesSection } from "./library-features-section";
import en from "@/i18n/messages/en.json";
import uk from "@/i18n/messages/uk.json";
import es from "@/i18n/messages/es.json";
import fr from "@/i18n/messages/fr.json";
import de from "@/i18n/messages/de.json";
import pt from "@/i18n/messages/pt-BR.json";

it.each([en, uk, es, fr, de, pt])(
  "renders localized Library roadmap cards",
  (messages) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LibraryFeaturesSection />
      </NextIntlClientProvider>,
    );

    expect(html).toContain(messages.library.features.label);
    for (const id of ["narration", "formats", "together"] as const) {
      expect(html).toContain(messages.library.features[id].title);
      expect(html).toContain(messages.library.features[id].body);
    }
    expect(html.match(/<article/g)).toHaveLength(3);
  },
);
