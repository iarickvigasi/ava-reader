import { writeUnlessDeleted } from "../library/deleted-items";
// Dexie I/O for full book content (TOC, chapter blocks).
import type {
  ReaderBookPayload,
  ReaderBlock,
  ReaderTocNode,
} from "@/lib/api-types/reader";

import { getDb } from "../../db";

export type SavedBookContent = {
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
  await writeUnlessDeleted(db, content.libraryItemId, [db.books], () =>
    db.books.put({
      libraryItemId: content.libraryItemId,
      toc: content.toc,
      chapterIds: content.chapterIds,
      metadata: content.metadata,
      fetchedAt: nowIso,
    }),
  );
}

export async function applyChapter(input: {
  libraryItemId: string;
  chapterId: string;
  index: number;
  blocks: ReaderBlock[];
  aux?: unknown;
}): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  await writeUnlessDeleted(db, input.libraryItemId, [db.bookChapters], () =>
    db.bookChapters.put({
      libraryItemId: input.libraryItemId,
      chapterId: input.chapterId,
      index: input.index,
      blocks: input.blocks,
      aux: input.aux,
      fetchedAt: nowIso,
    }),
  );
}

export async function readBookContent(libraryItemId: string) {
  const db = getDb();
  return db.books.get(libraryItemId);
}

// Resolves a slug to the book whose content is cached under it. `books` is the
// authority on what can be read offline: `libraryItems` only ever holds the
// collection *previews* the library payload carries (4 per collection), so a
// saved book outside every preview has no row there (spec 4.1, Read path). A
// scan is enough — the table is bounded by what the user saved.
export async function readBookIdBySlug(slug: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.books.toArray();
  const match = rows.find(
    (row) => (row.metadata as ReaderBookPayload | undefined)?.slug === slug,
  );
  return match?.libraryItemId ?? null;
}

export async function readChapter(libraryItemId: string, chapterId: string) {
  const db = getDb();
  return db.bookChapters.get([libraryItemId, chapterId]);
}

// Returns the list of chapter ids currently cached for this book. Used by
// the save flow to discover what's already on disk so re-saving doesn't
// refetch chapters we already have (e.g. resuming an interrupted save).
export async function readCachedChapterIds(
  libraryItemId: string,
): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.bookChapters
    .where("[libraryItemId+chapterId]")
    .between([libraryItemId, ""], [libraryItemId, "￿"])
    .toArray();
  return new Set(rows.map((row) => row.chapterId));
}
