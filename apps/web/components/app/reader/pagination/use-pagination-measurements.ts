import { useViewportSize } from "./use-viewport-size";
import { useMeasurementCache } from "./measurement/use-measurement-cache";
import { usePaginationLayoutKeys } from "./layout/use-pagination-layout-keys";
import { useSpreadBlocks } from "./layout/use-spread-blocks";
import type { UseReaderPaginationInput } from "./use-reader-pagination.types";

export function usePaginationMeasurements(
  input: Pick<
    UseReaderPaginationInput,
    | "activeChapter"
    | "previousChapter"
    | "nextChapter"
    | "fontScale"
    | "libraryItemId"
  >,
) {
  const viewport = useViewportSize();
  const keys = usePaginationLayoutKeys({
    ...input,
    pageBoxSize: viewport.pageBoxSize,
  });
  const measurement = useMeasurementCache(keys);
  // Cached measurements describe one chapter, not an unmeasured composed spread.
  const spread = useSpreadBlocks({
    ...input,
    ...measurement,
    pageBoxSize: viewport.pageBoxSize,
    separateChapter: true,
  });
  return { ...viewport, ...keys, ...measurement, ...spread };
}
