import type { ReaderLocator } from "./api-types";
import {
  findFirstVisibleBlockIndex,
  resolveTextOffsetTarget,
} from "./reader-locator-dom";

const FIRST_VISIBLE_CHARACTER_PADDING = 12;

type PageMetrics = {
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
      pageIndex: number;
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
      resolveLocator: (pageIndex: number) => ReaderLocator | null;
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
  layoutKey: string;
  pageBox: HTMLElement;
  pageGap: number;
}): ReaderMeasurementEntry {
  const metrics = resolvePageMetrics(input.pageBox, input.pageGap);

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
    resolveLocator(pageIndex) {
      return resolveLocatorFromPageIndex({
        article: input.article,
        chapterId: input.chapterId,
        metrics: resolvePageMetrics(input.pageBox, input.pageGap),
        pageCount,
        pageIndex,
      });
    },
    resolvePageIndex(locator) {
      return resolvePageIndexFromLocator({
        article: input.article,
        locator,
        metrics: resolvePageMetrics(input.pageBox, input.pageGap),
      });
    },
    status: "ready",
  };
}

function resolveLocatorFromPageIndex(input: {
  article: HTMLElement;
  chapterId: string;
  metrics: PageMetrics | null;
  pageCount: number;
  pageIndex: number;
}): ReaderLocator | null {
  const { article, chapterId, metrics, pageCount } = input;

  if (!metrics) {
    return null;
  }

  const safePageIndex = clamp(input.pageIndex, 0, Math.max(0, pageCount - 1));
  const pageWindow = createPageWindow(metrics, safePageIndex);
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

  const blockStartPageIndex = resolvePageIndexFromRect(
    blockElement.getBoundingClientRect(),
    metrics,
  );
  const segments = collectTextNodeSegments(blockElement);

  if (segments.length === 0) {
    return {
      pageIndex: blockStartPageIndex,
      status: "block-start",
    };
  }

  const boundaryRange = createCharacterRange(segments, locator.textOffset);
  const boundaryRect = boundaryRange ? getRangeRect(boundaryRange) : null;

  if (!boundaryRect) {
    return {
      pageIndex: blockStartPageIndex,
      status: "block-start",
    };
  }

  return {
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
  return Math.max(1, Math.ceil((article.scrollWidth + (metrics.pageSpan - metrics.pageWidth)) / metrics.pageSpan));
}

function resolvePageIndexFromRect(
  rect: Pick<DOMRect, "left" | "right">,
  metrics: PageMetrics,
) {
  const { left, right } = resolveAbsoluteHorizontalBounds(rect, metrics);
  const midpoint = left + Math.max(right - left, 1) / 2;

  return Math.floor(Math.max(midpoint, 0) / metrics.pageSpan);
}

function resolvePageMetrics(pageBox: HTMLElement, pageGap: number) {
  const pageWidth = Math.floor(pageBox.clientWidth);

  if (pageWidth <= 0) {
    return null;
  }

  return {
    pageBoxLeft: pageBox.getBoundingClientRect().left,
    pageSpan: pageWidth + pageGap,
    pageWidth,
  } satisfies PageMetrics;
}

function createPageWindow(metrics: PageMetrics, pageIndex: number) {
  const pageStart = pageIndex * metrics.pageSpan;

  return {
    pageEnd: pageStart + metrics.pageWidth,
    pageStart,
    visibleThreshold: pageStart + FIRST_VISIBLE_CHARACTER_PADDING,
  } satisfies PageWindow;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
