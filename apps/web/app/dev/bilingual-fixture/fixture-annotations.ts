import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderRangeLocator } from "@/lib/api-types/reader";
import { getDb } from "@/features/offline/db";

export async function seedFixtureAnnotations(chapter: BilingualChapter) {
  const unit = chapter.units.find((unit) => unit.id === "fixture-opening-0")!;
  const locator: ReaderRangeLocator = {
    chapterId: chapter.chapterId,
    startBlockId: unit.blockId,
    endBlockId: unit.blockId,
    startOffset: 0,
    endOffset: 2,
    contextBefore: "",
    contextAfter: "",
  };
  const createdAt = "2026-09-23T00:00:00.000Z";
  const db = getDb();
  await db.highlights.put({
    libraryItemId: chapter.libraryItemId,
    id: "fixture-highlight",
    excerpt: "We",
    color: "mimosa",
    locator,
    createdAt,
    updatedAt: createdAt,
  });
  await db.aiComments.put({
    libraryItemId: chapter.libraryItemId,
    id: "fixture-comment",
    kind: "EXPLAIN",
    sourceText: "We",
    body: "Saved explanation of the original word.",
    targetLang: null,
    locator,
    createdAt,
    status: "ready",
    error: null,
  });
  await db.aiComments.put({
    libraryItemId: chapter.libraryItemId,
    id: "fixture-translated-comment",
    kind: "EXPLAIN",
    sourceText: "We",
    body: "Saved explanation of the translated word.",
    targetLang: null,
    locator: {
      ...locator,
      startOffset: unit.startOffset,
      endOffset: unit.endOffset,
      translation: {
        targetLang: chapter.targetLang,
        contentRevision: chapter.contentRevision,
        startSentenceId: unit.id,
        endSentenceId: unit.id,
        startOffset: 0,
        endOffset: 2,
      },
    },
    createdAt,
    status: "ready",
    error: null,
  });
}
