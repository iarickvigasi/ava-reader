import {
  createFailedReaderMeasurementEntry,
  createPendingReaderMeasurementEntry,
  createReadyReaderMeasurementEntry,
  type ReaderMeasurementEntry,
} from "@/features/reader/measurement";

// Builds the measurement entry for a single chapter from its (possibly not yet
// mounted) offscreen refs:
//   - either ref missing → pending (the preloader hasn't rendered it yet);
//   - both present → ready, or failed if geometry reading throws.
export function measureChapterEntry(input: {
  article: HTMLElement | null;
  pageBox: HTMLDivElement | null;
  chapterId: string;
  layoutKey: string;
  columnCount: 1 | 2;
  pageGap: number;
}): ReaderMeasurementEntry {
  const { chapterId, layoutKey } = input;

  if (!input.article || !input.pageBox) {
    return createPendingReaderMeasurementEntry({ chapterId, layoutKey });
  }

  try {
    return createReadyReaderMeasurementEntry({
      article: input.article,
      chapterId,
      columnCount: input.columnCount,
      layoutKey,
      pageBox: input.pageBox,
      pageGap: input.pageGap,
    });
  } catch {
    return createFailedReaderMeasurementEntry({ chapterId, layoutKey });
  }
}
