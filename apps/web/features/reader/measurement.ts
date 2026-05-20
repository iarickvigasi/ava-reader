import type { ReaderLocator } from "@/lib/api-types";
import {
  findFirstVisibleBlockIndex,
  resolveTextOffsetTarget,
} from "./locator-dom";

const FIRST_VISIBLE_CHARACTER_PADDING = 12;

type PageMetrics = {
  columnCount: 1 | 2;
  pageBoxLeft: number;
  pageSpan: number;
  pageWidth: number;
};

type PageWindow = {
  pageEnd: number;
  pageStart: number;
  visibleThreshold: number;
};

type TextNodeSegment = {
  length: number;
  node: Text;
};

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

export type ReaderMeasurementEntry =
  | {
      chapterId: string;
      layoutKey: string;
      pageCount: number;
      status: "failed" | "pending";
    }
  | {
      chapterId: string;
      layoutKey: string;
      pageCount: number;
      // When the visible reader prepends a single-page previous chapter,
      // the active chapter's first visible spread starts at column 2 of
      // preloader spread 0. Pass `columnOffset: 2` so the search begins at
      // the column the user actually sees first; otherwise the published
      // locator points to content the user already saw with the previous
      // chapter and resume lands one page early.
      resolveLocator: (
        pageIndex: number,
        columnOffset?: 1 | 2,
      ) => ReaderLocator | null;
      resolvePageIndex: (
        locator: ReaderLocator,
      ) => ReaderMeasurementPageResolution;
      status: "ready";
    };

export function createPendingReaderMeasurementEntry(input: {
  chapterId: string;
  layoutKey: string;
}): ReaderMeasurementEntry {
  return {
    chapterId: input.chapterId,
    layoutKey: input.layoutKey,
    pageCount: 1,
    status: "pending",
  };
}

export function createFailedReaderMeasurementEntry(input: {
  chapterId: string;
  layoutKey: string;
}): ReaderMeasurementEntry {
  return {
    chapterId: input.chapterId,
    layoutKey: input.layoutKey,
    pageCount: 1,
    status: "failed",
  };
}

export function createReadyReaderMeasurementEntry(input: {
  article: HTMLElement;
  chapterId: string;
  columnCount: 1 | 2;
  layoutKey: string;
  pageBox: HTMLElement;
  pageGap: number;
}): ReaderMeasurementEntry {
  const metrics = resolvePageMetrics(
    input.pageBox,
    input.pageGap,
    input.columnCount,
  );

  if (!metrics) {
    return createPendingReaderMeasurementEntry({
      chapterId: input.chapterId,
      layoutKey: input.layoutKey,
    });
  }

  const pageCount = resolvePageCount(input.article, metrics);

  return {
    chapterId: input.chapterId,
    layoutKey: input.layoutKey,
    pageCount,
    resolveLocator(pageIndex, columnOffset = 1) {
      return resolveLocatorFromPageIndex({
        article: input.article,
        chapterId: input.chapterId,
        columnOffset,
        metrics: resolvePageMetrics(input.pageBox, input.pageGap, input.columnCount),
        pageCount,
        pageIndex,
      });
    },
    resolvePageIndex(locator) {
      return resolvePageIndexFromLocator({
        article: input.article,
        locator,
        metrics: resolvePageMetrics(input.pageBox, input.pageGap, input.columnCount),
      });
    },
    status: "ready",
  };
}

function resolveLocatorFromPageIndex(input: {
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

function resolvePageIndexFromLocator(input: {
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

function collectTextNodeSegments(root: HTMLElement) {
  if (root.dataset.readerBlockKind === "image") {
    return [] satisfies TextNodeSegment[];
  }

  const segments: TextNodeSegment[] = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!(node instanceof Text) || node.data.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }

        if (node.parentElement?.closest("noscript, script, style")) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    segments.push({
      length: textNode.data.length,
      node: textNode,
    });
    currentNode = walker.nextNode();
  }

  return segments;
}

function createCharacterRange(
  segments: ReadonlyArray<TextNodeSegment>,
  textOffset: number,
) {
  const target = resolveTextOffsetTarget(segments, textOffset);

  if (!target) {
    return null;
  }

  const segment = segments[target.nodeIndex];

  if (!segment || segment.length <= 0) {
    return null;
  }

  const range = segment.node.ownerDocument.createRange();
  range.setStart(segment.node, target.offsetInNode);
  range.setEnd(segment.node, Math.min(target.offsetInNode + 1, segment.length));

  return range;
}

function findBlockElement(article: HTMLElement, blockId: string) {
  for (const blockElement of article.querySelectorAll<HTMLElement>(
    "[data-reader-block='true']",
  )) {
    if (blockElement.dataset.blockId === blockId) {
      return blockElement;
    }
  }

  return null;
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

function getRangeRect(range: Range) {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );

  if (rects.length > 0) {
    return rects[0];
  }

  const boundingRect = range.getBoundingClientRect();

  return boundingRect.width > 0 || boundingRect.height > 0
    ? boundingRect
    : null;
}

function measureElementHorizontalBounds(
  element: HTMLElement,
  metrics: PageMetrics,
) {
  const { left, right } = resolveAbsoluteHorizontalBounds(
    element.getBoundingClientRect(),
    metrics,
  );

  return {
    end: right,
    start: left,
  };
}

function resolveAbsoluteHorizontalBounds(
  rect: Pick<DOMRect, "left" | "right">,
  metrics: PageMetrics,
) {
  return {
    left: rect.left - metrics.pageBoxLeft,
    right: rect.right - metrics.pageBoxLeft,
  };
}

function resolvePageCount(article: HTMLElement, metrics: PageMetrics) {
  // article.scrollWidth is unreliable on iOS Safari: with CSS multi-column
  // layout inside a parent that has overflow:hidden, WebKit clamps the
  // article's scrollWidth to its visible width, so every chapter reports
  // pageCount=1 and swipes fall through to next-chapter navigation. Blink
  // (and Chrome DevTools' mobile-simulator) doesn't have this bug, which
  // is why the issue only reproduces on iPhones.
  //
  // Workaround: measure the rightmost edge among the article's direct
  // children. In a multi-column flow each block lands inside some column
  // fragment; getBoundingClientRect() reports each fragment's true x
  // position even when it sits past the parent's overflow clip. The last
  // overflow column shows up as the maximum right edge we observe.
  const articleLeft = article.getBoundingClientRect().left;
  let measuredWidth = 0;
  for (const child of Array.from(article.children)) {
    const right = child.getBoundingClientRect().right - articleLeft;
    if (right > measuredWidth) {
      measuredWidth = right;
    }
  }
  // Defensive fallback: if no children produced a usable rect (empty
  // article, display:contents wrappers, etc.) degrade to scrollWidth so
  // engines without the WebKit clamp still get the previous behavior.
  const totalWidth = Math.max(measuredWidth, article.scrollWidth);
  return Math.max(
    1,
    Math.ceil((totalWidth + (metrics.pageSpan - metrics.pageWidth)) / metrics.pageSpan),
  );
}

function resolvePageIndexFromRect(
  rect: Pick<DOMRect, "left" | "right">,
  metrics: PageMetrics,
) {
  const { left, right } = resolveAbsoluteHorizontalBounds(rect, metrics);
  const midpoint = Math.max(left + Math.max(right - left, 1) / 2, 0);

  return Math.floor(midpoint / metrics.pageSpan);
}

// In single-column layouts every locator is in column 1. In two-column,
// the column is picked by the midpoint's position within the spread:
// before the gap midline → column 1, after → column 2.
function resolveColumnFromRect(
  rect: Pick<DOMRect, "left" | "right">,
  metrics: PageMetrics,
): 1 | 2 {
  if (metrics.columnCount === 1) {
    return 1;
  }

  const { left, right } = resolveAbsoluteHorizontalBounds(rect, metrics);
  const midpoint = Math.max(left + Math.max(right - left, 1) / 2, 0);
  const offsetInSpread = midpoint - Math.floor(midpoint / metrics.pageSpan) * metrics.pageSpan;

  return offsetInSpread < metrics.pageSpan / 2 ? 1 : 2;
}

function resolvePageMetrics(
  pageBox: HTMLElement,
  pageGap: number,
  columnCount: 1 | 2,
) {
  const pageWidth = Math.floor(pageBox.clientWidth);

  if (pageWidth <= 0) {
    return null;
  }

  return {
    columnCount,
    pageBoxLeft: pageBox.getBoundingClientRect().left,
    pageSpan: pageWidth + pageGap,
    pageWidth,
  } satisfies PageMetrics;
}

// In a two-column layout `columnOffset: 2` shifts the search to begin at
// the spread's right column — used by the visible reader when prefix
// content occupies the spread's left column and the user-visible page
// therefore starts half a spread later than the preloader's spread does.
function createPageWindow(
  metrics: PageMetrics,
  pageIndex: number,
  columnOffset: 1 | 2 = 1,
) {
  const halfSpreadShift =
    metrics.columnCount === 2 && columnOffset === 2
      ? metrics.pageSpan / 2
      : 0;
  const pageStart = pageIndex * metrics.pageSpan + halfSpreadShift;

  return {
    pageEnd: pageStart + metrics.pageWidth,
    pageStart,
    visibleThreshold: pageStart + FIRST_VISIBLE_CHARACTER_PADDING,
  } satisfies PageWindow;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
