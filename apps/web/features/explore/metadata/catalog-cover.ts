import { resolveApiAssetUrl } from "@/lib/api";
import type { CatalogWork } from "@/lib/catalog-types";

export function catalogCover(
  work: Pick<CatalogWork, "coverImageUrl" | "editions">,
) {
  return resolveApiAssetUrl(
    work.coverImageUrl ??
      work.editions?.find((edition) => edition.coverImageUrl)?.coverImageUrl ??
      null,
  );
}
