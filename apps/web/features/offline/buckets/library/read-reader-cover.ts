import { getDb } from "../../db";

export async function readReaderCover(slug: string) {
  const row = await getDb().libraryItems.where("slug").equals(slug).first();
  return row
    ? {
        title: row.title,
        libraryItemId: row.libraryItemId,
        src: row.coverImageUrl,
      }
    : null;
}
