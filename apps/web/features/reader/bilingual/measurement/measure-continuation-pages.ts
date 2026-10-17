import {
  resolvePageCount,
  type PageMetrics,
} from "@/features/reader/measurement/geometry";

const SHOW_TEXT = 4;

/** Fragmented text can extend beyond the wrapper bounds reported by WebKit. */
export function measureContinuationPages(
  element: HTMLElement,
  metrics: PageMetrics,
) {
  let count = resolvePageCount(element, metrics);
  const walker = element.ownerDocument.createTreeWalker(element, SHOW_TEXT);
  const range = element.ownerDocument.createRange();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("[data-reader-table-scroll]")) continue;
    range.selectNodeContents(node);
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
  }
  return count;
}
