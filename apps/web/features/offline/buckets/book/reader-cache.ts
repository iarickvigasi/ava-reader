// Builds the cached reader payload: active chapter and immediate neighbours.
import { readCanonicalCache } from "./canonical-cache";

import type {
  ReaderChapterPayload,
  ReaderStatusPayload,
  ReaderTocNode,
} from "@/lib/api-types/reader";

import { collectTocChapterEntries } from "@/features/reader/toc";
import { getDb } from "../../db";
import { readProgress } from "../progress/storage";
import { readReaderMetadata } from "./reader-metadata";
import { readBookAvailability } from "./storage";

export async function loadReaderPayloadFromCache(
  libraryItemId: string,
  chapterId?: string,
): Promise<ReaderStatusPayload | null> {
  const db = getDb();

  const availability = await readBookAvailability(libraryItemId);
  // Existing prepared EPUB passages remain readable without claiming a whole
  // book download from their older TOC-only manifest.
  const book = availability.readable ? availability.book : undefined;
  if (!book) {
    return null;
  }

  // Resolve the active chapter. When the caller didn't ask for a specific
  // chapter (initial page load), default to the first chapter in TOC order.
  const orderedIds = book.chapterIds;
  if (orderedIds.length === 0) {
    return null;
  }
  if (chapterId && !orderedIds.includes(chapterId)) return null;
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

  const labels = collectTocChapterEntries((book.toc ?? []) as ReaderTocNode[]);
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
      label: labels.get(id)?.label ?? id,
      title: labels.get(id)?.label ?? id,
      previousChapterId: orderedIds[idx - 1] ?? null,
      nextChapterId: orderedIds[idx + 1] ?? null,
      spineIndex: idx,
    });
  }

  if (!chapters.some((chapter) => chapter.chapterId === activeId)) {
    return null;
  }

  // Legacy downloads borrow language from cached book-info until refreshed.
  const toc = (book.toc ?? []) as ReaderTocNode[];
  const metadata = await readReaderMetadata(db, book);

  // Overlay the resume position from the progress bucket so a cached book
  // resumes on the right page even on a fresh/offline device that never wrote a
  // localStorage snapshot — the primer fills the bucket from the server (see
  // specs/4-offline/4.4-cache-priming, specs/2-reader/2.5-resume). Neutral when this device
  // has no row yet (never read + never primed → the reader starts at chapter 1).
  const progressRow = await readProgress(libraryItemId);
  if (getDb() !== db) return null;

  return readCanonicalCache(book, {
    chapterIds: book.chapterIds,
    contentRevision: book.contentRevision,
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
  });
}
