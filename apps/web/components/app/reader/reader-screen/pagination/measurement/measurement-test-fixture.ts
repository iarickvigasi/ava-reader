import type { ReaderMeasurementEntry } from "@/features/reader/measurement";

// Builds a ready measurement entry for helper tests. Override resolveLocator /
// resolvePageIndex to script the behaviour a given assertion needs.
export function createReadyMeasurementEntry(input?: {
  resolveLocator?: (pageIndex: number) => {
    blockId: string;
    chapterId: string;
    textOffset: number;
  } | null;
  resolvePageIndex?: () => {
    column: 1 | 2;
    pageIndex: number;
    status: "exact";
  };
}): Extract<ReaderMeasurementEntry, { status: "ready" }> {
  return {
    chapterId: "chapter-a",
    layoutKey: "layout:chapter-a",
    pageCount: 12,
    resolveLocator:
      input?.resolveLocator ??
      (() => ({
        blockId: "chapter-a::block-1",
        chapterId: "chapter-a",
        textOffset: 0,
      })),
    resolvePageIndex:
      input?.resolvePageIndex ??
      (() => ({
        column: 2,
        pageIndex: 0,
        status: "exact",
      })),
    status: "ready",
  };
}
