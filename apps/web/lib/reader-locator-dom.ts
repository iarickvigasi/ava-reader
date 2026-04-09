const FIRST_VISIBLE_CHARACTER_PADDING = 12;

export type TextOffsetTarget = {
  clampedTextOffset: number;
  nodeIndex: number;
  offsetInNode: number;
  totalLength: number;
};

export function resolveTextOffsetTarget(
  segments: ReadonlyArray<{ length: number }>,
  textOffset: number,
): TextOffsetTarget | null {
  const normalizedOffset =
    Number.isFinite(textOffset) && textOffset >= 0 ? Math.floor(textOffset) : 0;

  let totalLength = 0;
  let lastNonEmptyIndex = -1;

  for (let index = 0; index < segments.length; index += 1) {
    const length = normalizeSegmentLength(segments[index]?.length);

    if (length > 0) {
      lastNonEmptyIndex = index;
      totalLength += length;
    }
  }

  if (lastNonEmptyIndex === -1 || totalLength <= 0) {
    return null;
  }

  const clampedTextOffset = Math.min(normalizedOffset, totalLength - 1);
  let traversedLength = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const length = normalizeSegmentLength(segments[index]?.length);
    const nextTraversedLength = traversedLength + length;

    if (length > 0 && clampedTextOffset < nextTraversedLength) {
      return {
        clampedTextOffset,
        nodeIndex: index,
        offsetInNode: clampedTextOffset - traversedLength,
        totalLength,
      };
    }

    traversedLength = nextTraversedLength;
  }

  const lastSegmentLength = normalizeSegmentLength(
    segments[lastNonEmptyIndex]?.length,
  );

  return {
    clampedTextOffset,
    nodeIndex: lastNonEmptyIndex,
    offsetInNode: Math.max(lastSegmentLength - 1, 0),
    totalLength,
  };
}

export function findFirstVisibleBlockIndex(
  bounds: ReadonlyArray<{ end: number; start: number }>,
  pageStart: number,
  pageEnd: number,
  visibleThreshold: number = pageStart + FIRST_VISIBLE_CHARACTER_PADDING,
) {
  for (let index = 0; index < bounds.length; index += 1) {
    const bound = bounds[index];

    if (bound.end > visibleThreshold && bound.start < pageEnd) {
      return index;
    }
  }

  return -1;
}

function normalizeSegmentLength(length: number | undefined) {
  if (!Number.isFinite(length) || !length) {
    return 0;
  }

  return Math.max(0, Math.floor(length));
}
