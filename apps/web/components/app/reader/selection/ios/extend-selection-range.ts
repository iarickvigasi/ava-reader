import { wordRangeAt } from "./word-range-at";
import type { SelectionMode } from "./selection-mode-for-language";

// The anchor and target are complete selection units. Their union preserves
// the anchor when reversing direction or moving within the same word.
export function extendSelectionRange(
  anchor: Range,
  doc: Document,
  container: HTMLElement,
  x: number,
  y: number,
  mode: SelectionMode,
): Range | null {
  const target = wordRangeAt(doc, container, x, y, mode);

  if (!target || !container.contains(anchor.commonAncestorContainer)) {
    return null;
  }

  const next = anchor.cloneRange();

  try {
    if (anchor.comparePoint(target.startContainer, target.startOffset) < 0) {
      next.setStart(target.startContainer, target.startOffset);
    }
    if (anchor.comparePoint(target.endContainer, target.endOffset) > 0) {
      next.setEnd(target.endContainer, target.endOffset);
    }
  } catch {
    // comparePoint throws when the target lands in a detached/foreign tree
    // (mid-reflow); keeping the previous range is the right fallback.
    return null;
  }

  return next.collapsed ? null : next;
}
