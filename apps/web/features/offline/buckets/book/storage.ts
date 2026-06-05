// Dexie I/O for full book content (TOC, chapter blocks, cover blob).
//
// Two flags on the LibraryItemRow drive eviction semantics:
//   - savedOffline      → explicit user save. Sticky; never auto-evicted.
//   - savedAutomatically → set when the user just opened the book and we
//                          auto-saved it. At most one row in the DB has this
//                          flag without `savedOffline`; opening another book
//                          will evict the previous one (only after the new
//                          one finishes downloading — never offline).

import type {
  ReaderBookPayload,
  ReaderBlock,
  ReaderTocNode,
} from "@/lib/api-types/reader";

import { getDb, type LibraryItemRow } from "../../db";

// Marker for the `savedAt` field when a row is in the middle of an auto-save
// and we want to track that without committing to "saved" yet. The bucket
// uses a separate in-memory map for in-flight state; this is just the row's
// resting state.
export type SaveKind = "auto" | "explicit";

// ----- BookRow / ChapterRow helpers ------------------------------------------

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
  await db.books.put({
    libraryItemId: content.libraryItemId,
    toc: content.toc,
    chapterIds: content.chapterIds,
    metadata: content.metadata,
    fetchedAt: nowIso,
  });
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
  await db.bookChapters.put({
    libraryItemId: input.libraryItemId,
    chapterId: input.chapterId,
    index: input.index,
    blocks: input.blocks,
    aux: input.aux,
    fetchedAt: nowIso,
  });
}

export async function readBookContent(libraryItemId: string) {
  const db = getDb();
  return db.books.get(libraryItemId);
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
    .between(
      [libraryItemId, ""],
      [libraryItemId, "￿"],
    )
    .toArray();
  return new Set(rows.map((row) => row.chapterId));
}

// Deletes the book row + every chapter row + cover blob. Clears the saved-*
// flags on the LibraryItem row so the UI reflects "not downloaded". Does
// NOT remove the LibraryItem row itself — that's owned by the library
// bucket and reflects whether the user has the book in their library at all.
export async function deleteBookContent(libraryItemId: string): Promise<void> {
  const db = getDb();
  await db.transaction(
    "rw",
    [db.books, db.bookChapters, db.libraryItems],
    async () => {
      await db.books.delete(libraryItemId);
      await db.bookChapters
        .where("[libraryItemId+chapterId]")
        .between([libraryItemId, ""], [libraryItemId, "￿"])
        .delete();
      const row = await db.libraryItems.get(libraryItemId);
      if (row) {
        const next: LibraryItemRow = {
          ...row,
          coverBlob: null,
          savedOffline: false,
          savedAutomatically: false,
          savedAt: null,
        };
        await db.libraryItems.put(next);
      }
    },
  );
}

// ----- LibraryItemRow flag helpers -------------------------------------------

export async function markBookSaved(
  libraryItemId: string,
  kind: SaveKind,
): Promise<void> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row) {
    // The book has never been listed; we can't mark it saved without a row.
    // Caller should have ensured the library bucket has hydrated this book
    // before calling save (the reader page always has, via book-info / library
    // navigation). Bail quietly rather than write a half-row.
    return;
  }
  const nowIso = new Date().toISOString();
  const next: LibraryItemRow = {
    ...row,
    savedOffline: kind === "explicit" ? true : row.savedOffline,
    savedAutomatically: kind === "auto" ? true : row.savedAutomatically,
    savedAt: row.savedAt ?? nowIso,
  };
  await db.libraryItems.put(next);
}

export async function attachCoverBlob(
  libraryItemId: string,
  blob: Blob | null,
): Promise<void> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row) {
    return;
  }
  await db.libraryItems.put({ ...row, coverBlob: blob });
}

// Returns the libraryItemId of the current "auto-saved, not explicit" book
// — there's at most one of these by policy. Used at the end of a successful
// new auto-save to evict the previous one.
export async function findPreviousAutoSavedId(
  exceptLibraryItemId: string,
): Promise<string | null> {
  const db = getDb();
  const candidates = await db.libraryItems
    .filter((row) => row.savedAutomatically && !row.savedOffline)
    .toArray();
  const other = candidates.find(
    (row) => row.libraryItemId !== exceptLibraryItemId,
  );
  return other?.libraryItemId ?? null;
}

// True when the book has its full content (book row + at least one chapter)
// — what the BookContext uses to decide "missing-offline" vs "ready".
// Stricter checks (do we have *all* chapters?) are deferred to the bucket,
// which knows the expected count.
export async function hasBookContent(libraryItemId: string): Promise<boolean> {
  const db = getDb();
  const book = await db.books.get(libraryItemId);
  if (!book) {
    return false;
  }
  // Verify at least the first chapter is present. A successful save writes
  // BookRow last (after all chapters), so the presence of BookRow alone is
  // a reliable signal — but checking one chapter row is a cheap belt.
  if (book.chapterIds.length === 0) {
    return true;
  }
  const first = await db.bookChapters.get([
    libraryItemId,
    book.chapterIds[0],
  ]);
  return !!first;
}
