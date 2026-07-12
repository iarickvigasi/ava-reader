// The two directions of locator ↔ page resolution. These are the
// orchestration functions that combine geometry math with DOM walking.

import type { ReaderLocator } from "@/lib/api-types";
import {
  findFirstVisibleBlockIndex,
  resolveTextOffsetTarget,
} from "../selection-locator";
import {
  type PageMetrics,
  type PageWindow,
  createPageWindow,
  measureElementHorizontalBounds,
  resolveAbsoluteHorizontalBounds,
  resolveColumnFromRect,
  resolvePageIndexFromRect,
} from "./geometry";
import {
  type TextNodeSegment,
  collectTextNodeSegments,
  createCharacterRange,
  findBlockElement,
  getRangeRect,
} from "./dom-segments";

export type ReaderMeasurementPageResolution =
  | {
      // 0-based index of the spread the locator sits in within the
      // preloader's standalone layout of the chapter.
      pageIndex: number;
      // Which column of that preloader spread the locator sits in. 1 for
      // the left column, 2 for the right column. Always 1 in single-column
      // layouts. The visible reader can re-flow active-chapter content by
      // one column (prefix from a single-page previous chapter), in which
      // case the user's visible page differs from `pageIndex` for column-1
      // locators — see the prefix adjustment in useReaderPagination.
      column: 1 | 2;
      status: "block-start" | "exact";
    }
  | {
      status: "missing-block";
    };

export function resolveLocatorFromPageIndex(input: {
  article: HTMLElement;
  chapterId: string;
  columnOffset: 1 | 2;
  metrics: PageMetrics | null;
  pageCount: number;
  pageIndex: number;
}): ReaderLocator | null {
  const { article, chapterId, metrics, pageCount } = input;

  if (!metrics) {
    return null;
  }

  const safePageIndex = clamp(input.pageIndex, 0, Math.max(0, pageCount - 1));
  const pageWindow = createPageWindow(metrics, safePageIndex, input.columnOffset);
  const blockElements = Array.from(
    article.querySelectorAll<HTMLElement>("[data-reader-block='true']"),
  );

  if (blockElements.length === 0) {
    return null;
  }

  const blockIndex = findFirstVisibleBlockIndex(
    blockElements.map((element) =>
      measureElementHorizontalBounds(element, metrics),
    ),
    pageWindow.pageStart,
    pageWindow.pageEnd,
    pageWindow.visibleThreshold,
  );

  if (blockIndex === -1) {
    return null;
  }

  const block = blockElements[blockIndex];
  const blockId = block?.dataset.blockId;

  if (!block || !blockId) {
    return null;
  }

  const segments = collectTextNodeSegments(block);

  if (segments.length === 0) {
    return {
      blockId,
      chapterId,
      textOffset: 0,
    };
  }

  const firstVisibleTextOffset = findFirstVisibleTextOffset(
    segments,
    metrics,
    pageWindow,
  );

  return {
    blockId,
    chapterId,
    textOffset: firstVisibleTextOffset ?? 0,
  };
}

export function resolvePageIndexFromLocator(input: {
  article: HTMLElement;
  locator: ReaderLocator;
  metrics: PageMetrics | null;
}): ReaderMeasurementPageResolution {
  const { article, locator, metrics } = input;

  if (!metrics) {
    return {
      status: "missing-block",
    };
  }

  const blockElement = findBlockElement(article, locator.blockId);

  if (!blockElement) {
    return {
      status: "missing-block",
    };
  }

  const blockRect = blockElement.getBoundingClientRect();
  const blockStartPageIndex = resolvePageIndexFromRect(blockRect, metrics);
  const blockStartColumn = resolveColumnFromRect(blockRect, metrics);
  const segments = collectTextNodeSegments(blockElement);

  if (segments.length === 0) {
    return {
      column: blockStartColumn,
      pageIndex: blockStartPageIndex,
      status: "block-start",
    };
  }

  const boundaryRange = createCharacterRange(segments, locator.textOffset);
  const boundaryRect = boundaryRange ? getRangeRect(boundaryRange) : null;

  if (!boundaryRect) {
    return {
      column: blockStartColumn,
      pageIndex: blockStartPageIndex,
      status: "block-start",
    };
  }

  return {
    column: resolveColumnFromRect(boundaryRect, metrics),
    pageIndex: resolvePageIndexFromRect(boundaryRect, metrics),
    status: "exact",
  };
}

function findFirstVisibleTextOffset(
  segments: ReadonlyArray<TextNodeSegment>,
  metrics: PageMetrics,
  pageWindow: PageWindow,
) {
  const lastTarget = resolveTextOffsetTarget(segments, Number.MAX_SAFE_INTEGER);

  if (!lastTarget) {
    return 0;
  }

  let low = 0;
  let high = lastTarget.clampedTextOffset;
  let result: number | null = null;

  while (low <= high) {
    const candidate = Math.floor((low + high) / 2);
    const range = createCharacterRange(segments, candidate);
    const rect = range ? getRangeRect(range) : null;

    if (!rect) {
      return null;
    }

    const { left, right } = resolveAbsoluteHorizontalBounds(rect, metrics);

    if (right <= pageWindow.visibleThreshold) {
      low = candidate + 1;
      continue;
    }

    if (left >= pageWindow.pageEnd) {
      high = candidate - 1;
      continue;
    }

    result = candidate;
    high = candidate - 1;
  }

  return result;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
