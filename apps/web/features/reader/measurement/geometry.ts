// Page geometry primitives. Pure math over the page-box element and
// DOMRects — no knowledge of locators, blocks, or text.

const FIRST_VISIBLE_CHARACTER_PADDING = 12;

export type PageMetrics = {
  columnCount: 1 | 2;
  pageBoxLeft: number;
  pageSpan: number;
  pageWidth: number;
};

export type PageWindow = {
  pageEnd: number;
  pageStart: number;
  visibleThreshold: number;
};

export function resolvePageMetrics(
  pageBox: HTMLElement,
  pageGap: number,
  columnCount: 1 | 2,
): PageMetrics | null {
  const pageWidth = Math.floor(pageBox.clientWidth);

  if (pageWidth <= 0) {
    return null;
  }

  return {
    columnCount,
    pageBoxLeft: pageBox.getBoundingClientRect().left,
    pageSpan: pageWidth + pageGap,
    pageWidth,
  };
}

// In a two-column layout `columnOffset: 2` shifts the search to begin at
// the spread's right column — used by the visible reader when prefix
// content occupies the spread's left column and the user-visible page
// therefore starts half a spread later than the preloader's spread does.
export function createPageWindow(
  metrics: PageMetrics,
  pageIndex: number,
  columnOffset: 1 | 2 = 1,
): PageWindow {
  const halfSpreadShift =
    metrics.columnCount === 2 && columnOffset === 2
      ? metrics.pageSpan / 2
      : 0;
  const pageStart = pageIndex * metrics.pageSpan + halfSpreadShift;

  return {
    pageEnd: pageStart + metrics.pageWidth,
    pageStart,
    visibleThreshold: pageStart + FIRST_VISIBLE_CHARACTER_PADDING,
  };
}

export function resolveAbsoluteHorizontalBounds(
  rect: Pick<DOMRect, "left" | "right">,
  metrics: PageMetrics,
) {
  return {
    left: rect.left - metrics.pageBoxLeft,
    right: rect.right - metrics.pageBoxLeft,
  };
}

export function measureElementHorizontalBounds(
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

export function resolvePageIndexFromRect(
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
export function resolveColumnFromRect(
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

export function resolvePageCount(article: HTMLElement, metrics: PageMetrics) {
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
