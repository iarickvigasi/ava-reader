import type { ReaderRangeLocator } from "@/lib/api-types/reader";

type SourceFragment = {
  blockId: string;
  startOffset: number;
  endOffset: number;
};

/** Intersect a saved book range with one rendered sentence's source interval. */
export function clipLocatorToFragment(
  locator: ReaderRangeLocator | null,
  fragment: SourceFragment,
  { chapterId, blockIds }: { chapterId: string; blockIds: readonly string[] },
): ReaderRangeLocator | null {
  if (!locator || locator.chapterId !== chapterId) return null;
  const first = blockIds.indexOf(locator.startBlockId);
  const last = blockIds.indexOf(locator.endBlockId);
  const current = blockIds.indexOf(fragment.blockId);
  if (first < 0 || last < first || current < first || current > last)
    return null;
  const start = Math.max(
    fragment.startOffset,
    current === first ? locator.startOffset : 0,
  );
  const end = Math.min(
    fragment.endOffset,
    current === last ? locator.endOffset : Infinity,
  );
  if (end <= start) return null;
  return {
    ...locator,
    startBlockId: fragment.blockId,
    endBlockId: fragment.blockId,
    startOffset: start - fragment.startOffset,
    endOffset: end - fragment.startOffset,
  };
}
