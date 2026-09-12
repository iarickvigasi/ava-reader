import { extendSelectionRange } from "./extend-selection-range";
import { readRangeEndpoints } from "./range-endpoints";
import { selectionHandleAt } from "./selection-handle-at";
import { wordRangeAt } from "./word-range-at";
import { wordRangeFromCaret } from "./word-range-from-caret";
import type { SelectionMode } from "./selection-mode-for-language";

export type SelectionGestureParams = {
  doc: Document;
  mode: SelectionMode;
  getContainer: () => HTMLElement | null;
  // Paint every change of the live range; null means nothing selected.
  onPaint: (range: Range | null) => void;
};

export type SelectionGesture = ReturnType<typeof createSelectionGesture>;

export function createSelectionGesture({
  doc,
  mode,
  getContainer,
  onPaint,
}: SelectionGestureParams) {
  let anchor: Range | null = null;
  let range: Range | null = null;
  let isDragging = false;

  const setRange = (next: Range | null) => {
    range = next;
    onPaint(next);
  };

  const grabHandle = (x: number, y: number): boolean => {
    const container = getContainer();
    const endpoints = range && readRangeEndpoints(range);

    if (!range || !endpoints || !container) {
      return false;
    }

    const handle = selectionHandleAt(endpoints, x, y);
    if (!handle) {
      return false;
    }

    const isEnd = handle === "end";
    const caret = range.cloneRange();
    caret.collapse(isEnd);
    const affinity = isEnd ? "forward" : "backward";
    const unit = wordRangeFromCaret(doc, container, caret, mode, affinity);
    if (!unit) return false;
    anchor = unit;
    isDragging = true;

    return true;
  };

  const selectWordAt = (x: number, y: number) => {
    const container = getContainer();
    const word = container && wordRangeAt(doc, container, x, y, mode);

    if (!word) {
      return;
    }

    anchor = word;
    isDragging = true;
    setRange(word);
  };

  const dragTo = (x: number, y: number) => {
    const container = getContainer();
    const next =
      container && anchor && extendSelectionRange(anchor, doc, container, x, y, mode);

    if (next) {
      setRange(next);
    }
  };

  const clear = () => {
    anchor = null;
    isDragging = false;
    setRange(null);
  };

  return {
    grabHandle,
    selectWordAt,
    dragTo,
    clear,
    hasRange: () => range !== null,
    isDragging: () => isDragging,
    endDrag: () => {
      isDragging = false;
      return range;
    },
  };
}
