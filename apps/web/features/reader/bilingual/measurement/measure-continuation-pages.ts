import {
  resolvePageCount,
  type PageMetrics,
} from "@/features/reader/measurement/geometry";

/** Fragmented text can extend beyond the wrapper bounds reported by WebKit. */
export function measureContinuationPages(
  element: HTMLElement,
  metrics: PageMetrics,
) {
  let count = resolvePageCount(element, metrics);
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const right = rect.right - metrics.pageBoxLeft;
    count = Math.max(
      count,
      Math.ceil(
        (right + metrics.pageSpan - metrics.pageWidth) / metrics.pageSpan,
      ),
    );
  }
  return count;
}
