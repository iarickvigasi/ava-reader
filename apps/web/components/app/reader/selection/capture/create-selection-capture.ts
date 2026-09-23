import type { ReaderSelection, SelectionPointer } from "../types";
import { isInsideReader } from "./is-inside-reader";
import { resolveReaderSelection } from "./resolve-reader-selection";
import { createSettleScheduler } from "./settle-scheduler";
import { COMPAT_MOUSE_SUPPRESS_MS, IMMEDIATE_SETTLE_MS } from "./timing";

export type SelectionCapture = { destroy(): void };

type SelectionCaptureParams = {
  win: Window;
  doc: Document;
  getContainer: () => HTMLElement | null;
  onCapture: (selection: ReaderSelection) => void;
};

// The DOM side of selection capture (spec 2.6). Reads are deferred to the
// next tick (the selection isn't final when mouseup/touchend fires) through
// the settle scheduler's single slot, and capture is read-only: it reports
// the selection + pointer kind, and the AI toolbox owns dropping a touch
// capture's live selection when it opens (see use-drop-live-selection).
export function createSelectionCapture({
  win,
  doc,
  getContainer,
  onCapture,
}: SelectionCaptureParams): SelectionCapture {
  const scheduler = createSettleScheduler(win);
  let lastTouchAt = -Infinity;

  const checkSelection = (pointer: SelectionPointer) => {
    const selection = win.getSelection();
    const resolved = resolveReaderSelection(selection, getContainer());
    if (!resolved) {
      return;
    }
    onCapture({ ...resolved, pointer });
  };

  // The container gate keeps a mouseup on the panel/backdrop from re-reading
  // a lingering selection and re-opening the panel that click just closed.
  const handleMouseUp = (event: MouseEvent) => {
    if (Date.now() - lastTouchAt < COMPAT_MOUSE_SUPPRESS_MS) return;
    if (!isInsideReader(event.target, getContainer())) {
      return;
    }
    scheduler.schedule(IMMEDIATE_SETTLE_MS, () => checkSelection("mouse"));
  };

  // touchend reports the node the finger went down on, so this gate also
  // covers gestures that started outside the reader.
  const handleTouchEnd = (event: TouchEvent) => {
    lastTouchAt = Date.now();
    if (!isInsideReader(event.target, getContainer())) {
      return;
    }
    scheduler.schedule(IMMEDIATE_SETTLE_MS, () => checkSelection("touch"));
  };

  const touchListener = handleTouchEnd as EventListener;
  doc.addEventListener("mouseup", handleMouseUp);
  doc.addEventListener("touchend", touchListener);
  return {
    destroy: () => {
      scheduler.cancel();
      doc.removeEventListener("mouseup", handleMouseUp);
      doc.removeEventListener("touchend", touchListener);
    },
  };
}
