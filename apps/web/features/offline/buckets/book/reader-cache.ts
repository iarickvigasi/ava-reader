// Synthesises a `ReaderStatusPayload` from cached Dexie rows so the reader
// can render fully offline (or skip a network round-trip when online) when
// a book has been saved. Mirrors the windowed shape the API returns:
// `chapters[]` is the requested chapter plus its immediate neighbours.

import type {
  ReaderBookPayload,
  ReaderChapterPayload,
  ReaderStatusPayload,
  ReaderTocNode,
} from "@/lib/api-types/reader";

import { getDb } from "../../db";
import { readProgress } from "../progress/storage";

export async function loadReaderPayloadFromCache(
  libraryItemId: string,
  chapterId?: string,
): Promise<ReaderStatusPayload | null> {
  const db = getDb();

  const book = await db.books.get(libraryItemId);
  if (!book) {
    return null;
  }

  // Resolve the active chapter. When the caller didn't ask for a specific
  // chapter (initial page load), default to the first chapter in TOC order.
  const orderedIds = book.chapterIds;
  if (orderedIds.length === 0) {
    return null;
  }
  const activeId =
    chapterId && orderedIds.includes(chapterId) ? chapterId : orderedIds[0]!;
  const activeIndex = orderedIds.indexOf(activeId);

  // Pull the 3-chapter window around the active chapter — same shape the
  // server returns. Reads are issued in parallel; missing rows are filtered
  // out (an interrupted save can leave gaps).
  const windowIds = [
    orderedIds[activeIndex - 1],
    orderedIds[activeIndex],
    orderedIds[activeIndex + 1],
  ].filter((id): id is string => !!id);

  const rows = await Promise.all(
    windowIds.map((id) => db.bookChapters.get([libraryItemId, id])),
  );

  const chapters: ReaderChapterPayload[] = [];
  for (let i = 0; i < windowIds.length; i++) {
    const row = rows[i];
    if (!row) {
      continue;
    }
    const id = windowIds[i]!;
    const idx = orderedIds.indexOf(id);
    chapters.push({
      chapterId: id,
      blocks: row.blocks,
      href: `#${id}`,
      label: id,
      title: id,
      previousChapterId: orderedIds[idx - 1] ?? null,
      nextChapterId: orderedIds[idx + 1] ?? null,
      spineIndex: idx,
    });
  }

  if (chapters.length === 0) {
    return null;
  }

  // BookRow stores `toc` + `metadata` as `unknown` to keep the offline layer
  // decoupled from the still-evolving reader payload shape. The rows were
  // written by us from the same source types so the cast is safe.
  const toc = (book.toc ?? []) as ReaderTocNode[];
  const metadata = book.metadata as ReaderBookPayload;

  // Overlay the resume position from the progress bucket so a cached book
  // resumes on the right page even on a fresh/offline device that never wrote a
  // localStorage snapshot — the primer fills the bucket from the server (see
  // specs/11-cache-priming, specs/1-reader/5-resume). Neutral when this device
  // has no row yet (never read + never primed → the reader starts at chapter 1).
  const progressRow = await readProgress(libraryItemId);

  return {
    status: "READY",
    activeChapterId: activeId,
    book: metadata,
    chapters,
    progress: {
      chapterLabel: null,
      completionPercent: progressRow?.completionPercent ?? 0,
      lastReadAt: progressRow?.lastReadAt ?? null,
      locator: progressRow?.locator ?? null,
    },
    toc,
  };
}
