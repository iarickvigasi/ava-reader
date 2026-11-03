import type { CatalogWork } from "@/lib/catalog-types";
import { catalogText } from "./catalog-text";
export function catalogTitle(work: CatalogWork, locale: string) {
  return catalogText(work.texts, locale)?.title ?? work.originalTitle;
}
