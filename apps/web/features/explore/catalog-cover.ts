import type { CatalogWork } from "@/lib/catalog-types";

export function catalogCover(work: CatalogWork) {
  return work.coverImageUrl ?? work.editions?.[0]?.coverImageUrl ?? null;
}
