import type { CatalogText, CatalogWork } from "@/lib/catalog-types";

export function catalogText(texts: CatalogText[], locale: string) {
  return (
    texts.find((text) => text.locale === locale) ??
    texts.find((text) => text.locale === locale.split("-")[0]) ??
    texts.find((text) => text.locale === "en") ??
    texts[0]
  );
}

export function catalogTitle(work: CatalogWork, locale: string) {
  return catalogText(work.texts, locale)?.title ?? work.originalTitle;
}

export function languageName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames(locale, { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
