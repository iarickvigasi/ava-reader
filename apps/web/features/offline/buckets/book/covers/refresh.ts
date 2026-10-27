import { resolveApiAssetUrl } from "@/lib/api";
import type { AvaReaderDB } from "../../../db";
import { attachCoverBlob } from "./attach";
import { fetchCover } from "./fetch-cover";
import { isValidCover } from "./validate";

export async function refreshCover(
  db: AvaReaderDB,
  id: string,
  src: string,
): Promise<void> {
  try {
    const item = await db.libraryItems.get(id);
    if (
      !item ||
      resolveApiAssetUrl(item.coverImageUrl) !== resolveApiAssetUrl(src)
    )
      return;
    const row = await db.bookCovers.get(id);
    if (
      row?.verified &&
      row.sourceUrl === item.coverImageUrl &&
      (await isValidCover(row))
    )
      return;
    const response = await fetchCover(src);
    if (response.ok) await attachCoverBlob(id, await response.blob(), src, db);
  } catch {
    // Keep valid offline legacy artwork when revalidation cannot complete.
  }
}
