import { HANDLE_GRAB_RADIUS_PX } from "../capture/timing";
import { extendSelectionRange } from "./extend-selection-range";
import { isWithin, readRangeEndpoints } from "./range-endpoints";
import { wordRangeAt } from "./word-range-at";

export type SelectionGestureParams = {
  doc: Document;
  getContainer: () => HTMLElement | null;
  // Fires on every change of the live range so the overlay repaints it; null
  // means "nothing selected".
  onPaint: (range: Range | null) => void;
};

export type SelectionGesture = ReturnType<typeof createSelectionGesture>;

// What the iOS gesture *means*, with no event handling in it (spec 1.6
// Behaviour 8): the current range, the anchor a drag grows from, and the four
// moves the finger can make on them.
export function createSelectionGesture({
  doc,
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

  // A touch on either handle re-grabs that end, anchoring the drag to the other.
  const grabHandle = (x: number, y: number): boolean => {
    const endpoints = range && readRangeEndpoints(range);

    if (!range || !endpoints) {
      return false;
    }

    const isEnd = isWithin(endpoints.end, x, y, HANDLE_GRAB_RADIUS_PX);
    const isStart = isWithin(endpoints.start, x, y, HANDLE_GRAB_RADIUS_PX);

    if (!isEnd && !isStart) {
      return false;
    }

    anchor = range.cloneRange();
    anchor.collapse(isEnd);
    isDragging = true;

    return true;
  };

  const selectWordAt = (x: number, y: number) => {
    const container = getContainer();
    const word = container && wordRangeAt(doc, container, x, y);

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
      container && anchor && extendSelectionRange(anchor, doc, container, x, y);

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
