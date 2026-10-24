"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogText } from "@/lib/catalog-types";
import { catalogText, languageName } from "./catalog-display";
import { parseBookDescription } from "@/features/library/book-description/parse-book-description";

export function useCatalogDescription(texts: CatalogText[]) {
  const locale = useLocale();
  const t = useTranslations("explore");
  const [selected, setSelected] = useState<string | null>(null);
  const available = texts
    .filter((text) => parseBookDescription(text.description ?? null).length > 0)
    .map((text) => ({
      ...text,
      label:
        text.locale === "und"
          ? t("unspecifiedLanguage")
          : languageName(text.locale, locale),
    }));
  const active =
    available.find((text) => text.locale === selected) ??
    catalogText(available, locale);
  return { locale, available, active, select: setSelected };
}
