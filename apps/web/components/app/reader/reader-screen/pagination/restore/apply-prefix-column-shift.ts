import type { ReaderMeasurementPageResolution } from "@/features/reader/measurement";

// The preloader measures each chapter standalone, so its pageIndex is in
// "preloader spread" space. When the visible reader prepends a single-page
// previous chapter (prefixPageCount > 0), the active chapter's first block is
// forced into column 2 of the first visible spread. Active-chapter content that
// lives in column 1 of a preloader spread therefore ends up on the user's
// previous visible page; column-2 content stays put.
export function applyPrefixColumnShift(
  resolution: ReaderMeasurementPageResolution | null,
  prefixPageCount: number,
): ReaderMeasurementPageResolution | null {
  if (
    !resolution ||
    resolution.status === "missing-block" ||
    prefixPageCount === 0 ||
    resolution.column !== 1
  ) {
    return resolution;
  }
  return {
    ...resolution,
    pageIndex: Math.max(0, resolution.pageIndex - prefixPageCount),
  };
}
