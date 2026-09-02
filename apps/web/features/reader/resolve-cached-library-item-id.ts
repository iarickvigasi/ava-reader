// Resolves a reader slug to a libraryItemId using what this device actually
// holds. Two sources, in order of cost: the library preview cache, then the
// downloaded content itself.
//
// The second one is not a nicety. `libraryItems` mirrors the /library payload,
// which carries only the first 4 books of each collection, and applying that
// payload clears the table — so a saved book that has dropped out of every
// preview has no row there while its chapters sit fully cached in `books`.
// Gating the offline read on `libraryItems` made those books unopenable
// (spec 4.1, Read path).

import { readBookIdBySlug } from "@/features/offline/buckets/book";
import { readLibraryItemIdBySlug } from "@/features/offline/buckets/library/storage";

export async function resolveCachedLibraryItemId(
  slug: string,
): Promise<string | null> {
  const fromLibraryPreview = await readLibraryItemIdBySlug(slug);
  if (fromLibraryPreview) {
    return fromLibraryPreview;
  }
  return readBookIdBySlug(slug);
}
