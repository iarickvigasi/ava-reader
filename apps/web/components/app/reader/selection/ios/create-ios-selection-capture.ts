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

// Bind the iOS gesture to touch events, sharing native capture's output (spec 2.6).
export function createIosSelectionCapture({
  win,
  doc,
  mode,
  getContainer,
  onPaint,
  onCapture,
}: IosSelectionCaptureParams): SelectionCapture {
  const gesture = createSelectionGesture({ doc, mode, getContainer, onPaint });
  let ownsTouch = false;
  const press = createPressTimer(win, () => {
    const { x, y } = press.origin();
    gesture.selectWordAt(x, y);
  });

  const handleTouchStart = (event: TouchEvent) => {
    const container = getContainer();
    if (
      !container ||
      !(event.target instanceof Node) ||
      !container.contains(event.target) ||
      event.touches.length !== 1
    ) {
      press.cancel();
      ownsTouch = false;
      gesture.clear();
      return;
    }
    ownsTouch = true;
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
    if (!ownsTouch) return;
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
    if (!ownsTouch) return;
    ownsTouch = false;
    press.cancel();

    if (!gesture.isDragging()) {
      return;
    }

    const range = gesture.endDrag();
    const text = range?.toString().trim() ?? "";
    // A compatibility click can otherwise land on the newly opened panel's
    // backdrop and immediately dismiss it. Selection owns this whole gesture.
    event.preventDefault();
    event.stopPropagation();

    if (range && text.length > 0) {
      onCapture({ text, range, pointer: "touch" });
    }
  };

  const handleTouchCancel = () => {
    ownsTouch = false;
    press.cancel();
    gesture.clear();
  };

  doc.addEventListener("touchstart", handleTouchStart, true);
  doc.addEventListener("touchmove", handleTouchMove, {
    capture: true,
    passive: false,
  });
  doc.addEventListener("touchend", handleTouchEnd, { capture: true, passive: false });
  doc.addEventListener("touchcancel", handleTouchCancel, true);

  return {
    destroy: () => {
      press.cancel();
      gesture.clear();
      doc.removeEventListener("touchstart", handleTouchStart, true);
      doc.removeEventListener("touchmove", handleTouchMove, true);
      doc.removeEventListener("touchend", handleTouchEnd, true);
      doc.removeEventListener("touchcancel", handleTouchCancel, true);
    },
  };
}
