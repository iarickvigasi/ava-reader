import type { CatalogText } from "@/lib/catalog-types";
import { parseBookDescription } from "@/features/library/book-description/parse-book-description";
export function workDescriptionTexts(
  texts: CatalogText[],
  description?: string | null,
  language?: string | null,
) {
  if (description && parseBookDescription(description).length)
    return [{ locale: language ?? "und", description }];
  return texts.filter(
    (text) => parseBookDescription(text.description ?? null).length > 0,
  );
}
