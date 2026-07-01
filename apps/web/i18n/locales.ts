// Supported UI locales. Adding a new locale = add the BCP-47 tag here, ship a
// matching i18n/messages/<tag>.json, and add a label below.
//
// This is intentionally separate from the 92-language list used for AI
// content translation (see reader/.../translate-languages.ts) — those
// translations are generated on demand, while UI strings have to be
// hand-translated and shipped per locale.

export const locales = ["en", "es", "fr", "de", "pt-BR", "uk"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const LOCALE_COOKIE = "ava-locale";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  "pt-BR": "Português (Brasil)",
  uk: "Українська",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  );
}
