import { caretRangeAt } from "./caret-range-at";
import { wordRangeFromCaret } from "./word-range-from-caret";

// The whole word or grapheme under (x, y), or null outside visible text.
// Shared by long-press and dragging in the app-owned iOS selection (spec 2.6).
export function wordRangeAt(
  doc: Document,
  container: HTMLElement,
  x: number,
  y: number,
): Range | null {
  const caret = caretRangeAt(doc, container, x, y);
  if (!caret || !containsPoint(container.getBoundingClientRect(), x, y)) {
    return null;
  }

  // A caret lies after a glyph when its right half is hit. Check both adjacent
  // units against their painted rects, so that glyph still selects itself.
  for (const affinity of ["forward", "backward"] as const) {
    const range = wordRangeFromCaret(doc, container, caret, affinity);
    if (range && Array.from(range.getClientRects()).some(
      (rect) => containsPoint(rect, x, y),
    )) {
      return range;
    }
  }
  return null;
}

function containsPoint(rect: DOMRect, x: number, y: number): boolean {
  return rect.width > 0 && rect.height > 0 &&
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
