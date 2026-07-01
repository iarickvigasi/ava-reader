// Dexie I/O for full book content (TOC, chapter blocks, cover blob).
//
// Two flags on the LibraryItemRow drive eviction semantics:
//   - savedOffline      → explicit user save. Sticky; never auto-evicted.
//   - savedAutomatically → set when the user just opened the book and we
//                          auto-saved it. In steady state at most one row has
//                          this flag without `savedOffline`; opening another
//                          book evicts it (reader-driven, online only — never
//                          offline). See ./evict.

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

// Returns the libraryItemIds of every "auto-saved, not explicit" book other
// than the one currently open. In steady state there's at most one, but a
// release ([[13-offline-save-button]]) can briefly leave a second, so this
// returns all of them. The reader uses it to drop stale auto-caches when the
// user opens another book (see ./evict).
export async function findEvictableAutoSavedIds(
  currentLibraryItemId: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db.libraryItems
    .filter((row) => row.savedAutomatically && !row.savedOffline)
    .toArray();
  return rows
    .filter((row) => row.libraryItemId !== currentLibraryItemId)
    .map((row) => row.libraryItemId);
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

// How the book is held offline, for the book-info "Download for offline" card:
//   - "absent"   → no content cached → offer "Save for offline".
//   - "auto"     → cached implicitly while reading; evictable (the single
//                  auto-save slot). Offer "Keep for offline" to make it sticky.
//   - "explicit" → the user (or a synced intent) chose to keep it. Offer
//                  "Remove from downloads".
// Distinguishes auto from explicit via the LibraryItem's `savedOffline` flag,
// which `hasBookContent` alone can't tell apart.
export type OfflineState = "absent" | "auto" | "explicit";

// Detailed offline state for the book-info card. `fromAutoSave` is only
// meaningful for "explicit": it records whether the book was originally
// auto-saved (so "stop keeping" preserves the cached content and drops back to
// the evictable auto-cache) versus explicitly downloaded from scratch (so
// "remove" deletes it and returns to "Save for offline").
// `offlineRequested` is the server-synced "keep this book offline" intent
// (see [[12-offline-save-sync]]). It is reported even when state is "absent"
// (no content cached yet) so the book-info card can show "Download queued" —
// a request made offline must survive leaving and reopening the page.
export type OfflineDetail = {
  state: OfflineState;
  fromAutoSave: boolean;
  offlineRequested: boolean;
};

export async function readOfflineState(
  libraryItemId: string,
): Promise<OfflineDetail> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  const offlineRequested = row?.offlineRequested === true;
  if (!(await hasBookContent(libraryItemId))) {
    return { state: "absent", fromAutoSave: false, offlineRequested };
  }
  return {
    state: row?.savedOffline ? "explicit" : "auto",
    fromAutoSave: row?.savedAutomatically === true,
    offlineRequested,
  };
}
