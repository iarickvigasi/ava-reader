import { getActiveUserId, getDb } from "../../db";

type ReaderCover = { title: string; libraryItemId: string; src: string | null };
const MAX_READER_COVERS = 16;
const covers = new Map<string, { owner: string | null; cover: ReaderCover }>();

export function readWarmReaderCover(slug: string) {
  const entry = covers.get(slug);
  return entry?.owner === getActiveUserId() ? entry.cover : null;
}

export function clearWarmReaderCovers() {
  covers.clear();
}

export async function readReaderCover(slug: string) {
  const db = getDb();
  const owner = getActiveUserId();
  const row = await db.libraryItems.where("slug").equals(slug).first();
  if (db !== getDb() || owner !== getActiveUserId()) return null;
  const cover = row
    ? {
        title: row.title,
        libraryItemId: row.libraryItemId,
        src: row.coverImageUrl,
      }
    : null;
  covers.delete(slug);
  if (cover) covers.set(slug, { owner, cover });
  if (covers.size > MAX_READER_COVERS)
    covers.delete(covers.keys().next().value!);
  return cover;
}
