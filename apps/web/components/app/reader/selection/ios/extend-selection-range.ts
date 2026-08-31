import { caretRangeAt } from "./caret-range-at";

// Grows the range from a fixed anchor point to the caret under (x, y), in
// either direction, so dragging back past the anchor selects backwards
// instead of collapsing.
export function extendSelectionRange(
  anchor: Range,
  doc: Document,
  container: HTMLElement,
  x: number,
  y: number,
): Range | null {
  const caret = caretRangeAt(doc, container, x, y);

  if (!caret) {
    return null;
  }

  const next = anchor.cloneRange();

  try {
    const isAfterAnchorStart =
      anchor.comparePoint(caret.startContainer, caret.startOffset) >= 0;

    if (isAfterAnchorStart) {
      next.setEnd(caret.startContainer, caret.startOffset);
    } else {
      next.setStart(caret.startContainer, caret.startOffset);
      next.setEnd(anchor.endContainer, anchor.endOffset);
    }
  } catch {
    // comparePoint throws when the caret lands in a detached/foreign tree
    // (mid-reflow); keeping the previous range is the right fallback.
    return null;
  }

  return next.collapsed ? null : next;
}
