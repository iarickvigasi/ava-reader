import type {
  ReaderStatusPayload,
  ReaderTocNode,
} from "@/lib/api-types/reader";
import { getDb } from "../../../db";

export const tocNode: ReaderTocNode = {
  id: "toc",
  chapterId: "chapter-1",
  spineIndex: 0,
  label: "Chapter 1",
  anchorId: null,
  blockId: "block-1",
  href: "chapter.xhtml",
  children: [],
};
export const bookMetadata = {
  libraryItemId: "book",
  slug: "book",
  title: "Book",
  authors: [],
  language: "en",
  primaryFormat: "EPUB" as const,
};
export const updated: Extract<ReaderStatusPayload, { status: "READY" }> = {
  status: "READY",
  activeChapterId: "chapter-1",
  book: bookMetadata,
  chapters: [],
  progress: {
    chapterLabel: null,
    completionPercent: 0,
    lastReadAt: null,
    locator: null,
  },
  toc: [{ ...tocNode, label: "1. Opening words…" }],
};

export async function seedDownload() {
  const db = getDb();
  await db.books.put({
    libraryItemId: "book",
    metadata: bookMetadata,
    chapterIds: ["chapter-1"],
    toc: [tocNode],
    fetchedAt: "original",
  });
  await db.bookChapters.put({
    libraryItemId: "book",
    chapterId: "chapter-1",
    index: 0,
    blocks: [
      { id: "block-1", kind: "paragraph", text: "Opening words.", inlines: [] },
    ],
    aux: { untouched: true },
    fetchedAt: "original",
  });
  await db.preferenceMutations.put({
    mutationId: "pending",
    kind: "patch",
    scopeId: "me",
    payload: { fontScale: 1.2 },
    queuedAt: "original",
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: null,
  });
  return db;
}
