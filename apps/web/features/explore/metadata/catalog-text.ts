import type { CatalogText } from "@/lib/catalog-types";

export function catalogText(texts: CatalogText[], locale: string) {
  return (
    texts.find((text) => text.locale === locale) ??
    texts.find((text) => text.locale === locale.split("-")[0]) ??
    texts.find((text) => text.locale === "en") ??
    texts[0]
  );
}
