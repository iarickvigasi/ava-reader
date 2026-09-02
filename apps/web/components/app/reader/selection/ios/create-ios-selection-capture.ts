import type { ReaderSelection } from "../types";
import type { SelectionCapture } from "../capture/create-selection-capture";
import {
  createSelectionGesture,
  type SelectionGestureParams,
} from "./create-selection-gesture";
import { createPressTimer } from "./create-press-timer";

export type IosSelectionCaptureParams = SelectionGestureParams & {
  win: Window;
  onCapture: (selection: ReaderSelection) => void;
};

// Binds the iOS selection gesture to touch events (spec 2.6 Behaviour 8).
// Release reports the range through the same onCapture the native path uses,
// leaving the panel and locator pipeline unchanged.
export function createIosSelectionCapture({
  win,
  doc,
  getContainer,
  onPaint,
  onCapture,
}: IosSelectionCaptureParams): SelectionCapture {
  const gesture = createSelectionGesture({ doc, getContainer, onPaint });
  const press = createPressTimer(win, () => {
    const { x, y } = press.origin();
    gesture.selectWordAt(x, y);
  });

  const handleTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    press.cancel();

    if (!touch) {
      return;
    }
    if (gesture.grabHandle(touch.clientX, touch.clientY)) {
      return;
    }

    // A tap while something is selected dismisses it, as tapping away from a
    // native selection does.
    if (gesture.hasRange()) {
      gesture.clear();
      return;
    }

    press.arm(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }
    if (!gesture.isDragging()) {
      press.cancelIfDrifted(touch.clientX, touch.clientY);
      return;
    }

    // Owning the gesture is what keeps a selection drag from also turning the
    // page — the swipe handler never sees these events.
    event.preventDefault();
    event.stopPropagation();
    gesture.dragTo(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    press.cancel();

    if (!gesture.isDragging()) {
      return;
    }

    const range = gesture.endDrag();
    const text = range?.toString().trim() ?? "";
    event.stopPropagation();

    if (range && text.length > 0) {
      onCapture({ text, range, pointer: "touch" });
    }
  };

  doc.addEventListener("touchstart", handleTouchStart, true);
  doc.addEventListener("touchmove", handleTouchMove, {
    capture: true,
    passive: false,
  });
  doc.addEventListener("touchend", handleTouchEnd, true);

  return {
    destroy: () => {
      press.cancel();
      doc.removeEventListener("touchstart", handleTouchStart, true);
      doc.removeEventListener("touchmove", handleTouchMove, true);
      doc.removeEventListener("touchend", handleTouchEnd, true);
    },
  };
}
