import type { ReaderBookPayload, ReaderTocNode } from "@/lib/api-types/reader";
import { getDb } from "../../db";
import { writeUnlessDeleted } from "../library/deleted-items";
export type SavedBookContent = {
  canonical?: import("./canonical-cache").CanonicalCache;
  libraryItemId: string;
  toc: ReaderTocNode[];
  chapterIds: string[];
  metadata: ReaderBookPayload;
};

export async function applyBookContent(
  content: SavedBookContent,
): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  await writeUnlessDeleted(
    db,
    content.libraryItemId,
    [db.books, db.libraryItems],
    async () => {
      const item = await db.libraryItems.get(content.libraryItemId);
      const metadata =
        item?.metadataEditVersion !== undefined
          ? {
              ...content.metadata,
              title: item.title,
              authors: item.authors,
              language: item.details
                ? item.details.language
                : content.metadata.language,
            }
          : content.metadata;
      return db.books.put({
        libraryItemId: content.libraryItemId,
        toc: content.toc,
        chapterIds: content.chapterIds,
        metadata,
        canonical: content.canonical,
        fetchedAt: nowIso,
      });
    },
  );
}
