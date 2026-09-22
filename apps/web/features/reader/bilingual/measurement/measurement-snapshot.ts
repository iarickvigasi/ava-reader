import type { BilingualChapter } from "@/lib/api-types/bilingual";

export type PairMeasurementSnapshot<T> = {
  chapter: BilingualChapter;
  key: string;
  result: T;
};

/** Keep visible content and its geometry together while an incremental update is measured. */
export function resolveMeasurementSnapshot<T>(
  snapshot: PairMeasurementSnapshot<T> | null,
  chapter: BilingualChapter | null,
  layoutKey: string,
) {
  const compatible =
    snapshot &&
    chapter &&
    snapshot.key === layoutKey &&
    snapshot.chapter.libraryItemId === chapter.libraryItemId &&
    snapshot.chapter.chapterId === chapter.chapterId &&
    snapshot.chapter.contentRevision === chapter.contentRevision &&
    snapshot.chapter.translationVersion === chapter.translationVersion &&
    snapshot.chapter.targetLang === chapter.targetLang;
  const current = compatible ? snapshot : null;
  return {
    measuredChapter: current?.chapter ?? null,
    measurement: current?.result ?? null,
    // Measurements read live DOM lazily. Consumers defer navigation/new demand
    // until the updated chapter and its measured geometry are committed together.
    isMeasuring: chapter !== null && current?.chapter !== chapter,
  };
}
