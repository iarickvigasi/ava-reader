import { useEffect, useRef, type RefObject } from "react";
import { isInsideReader } from "./is-inside-reader";
import { resolveReaderSelection } from "./resolve-reader-selection";
import { createSettleScheduler } from "./settle-scheduler";
import type { TouchActivity } from "./touch-activity";
import { IMMEDIATE_SETTLE_MS, TOUCH_SETTLE_MS } from "./timing";
import type { ReaderSelection } from "./types";

type UseReaderSelectionCaptureParams = {
  containerRef: RefObject<HTMLElement | null>;
  // Shared with the native-menu hook; mutated here on touch events.
  touchActivity: TouchActivity;
  onSelectText: (selection: ReaderSelection) => void;
  disabled: boolean;
};

// Watches mouse and touch gestures inside the reader and reports the settled
// selection. Mouse capture runs on the next tick; touch capture also follows
// touchcancel/selectionchange so a native long-press takeover can settle.
export function useReaderSelectionCapture({
  containerRef,
  touchActivity,
  onSelectText,
  disabled,
}: UseReaderSelectionCaptureParams) {
  // Keep the latest callback in a ref so the listeners don't need to be torn
  // down and re-bound on every render.
  const onSelectRef = useRef(onSelectText);
  useEffect(() => {
    onSelectRef.current = onSelectText;
  }, [onSelectText]);

  useEffect(() => {
    if (disabled) {
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const scheduler = createSettleScheduler(window);

    const checkSelection = (dropLiveSelection: boolean) => {
      const selection = window.getSelection();
      const container = containerRef.current;
      const readerSelection = resolveReaderSelection(selection, container);
      if (!readerSelection) {
        return;
      }

      onSelectRef.current(readerSelection);

      // On touch, drop the live selection so the OS "native callout" (glossary)
      // can't render over the panel. We've already captured text + range, and
      // the AI tools operate on those, not on window.getSelection().
      if (dropLiveSelection && selection) {
        selection.removeAllRanges();
      }
    };

    // Touch-origin checks drop the live selection (to hide the native callout)
    // and skip if a fresh touch has started in the meantime — otherwise we'd
    // read a selection the user is still building.
    const scheduleTouchCheck = (delay: number) => {
      scheduler.schedule(delay, () => {
        if (touchActivity.isActive()) {
          return;
        }
        checkSelection(true);
      });
    };

    // Mouse-origin checks keep the live selection (desktop has no native
    // callout collision) and always run once settled.
    const scheduleMouseCheck = () => {
      scheduler.schedule(IMMEDIATE_SETTLE_MS, () => {
        checkSelection(false);
      });
    };

    // Reads are deferred (the selection isn't final when mouseup/touchend
    // fires) and gated to the container: a mouseup on the panel/backdrop must
    // not run a check, or a backdrop click that closes the panel would also
    // see the lingering selection and immediately re-open it.
    const handleMouseUp = (event: MouseEvent) => {
      if (!isInsideReader(event.target, containerRef.current)) {
        return;
      }
      scheduleMouseCheck();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isInsideReader(event.target, containerRef.current)) {
        touchActivity.start();
      } else {
        touchActivity.end();
      }
    };

    const handleTouchEnd = () => {
      if (!touchActivity.isActive()) {
        return;
      }
      touchActivity.end();
      scheduleTouchCheck(IMMEDIATE_SETTLE_MS);
    };

    const handleTouchCancel = () => {
      if (!touchActivity.isActive()) {
        return;
      }
      touchActivity.end();
      scheduleTouchCheck(TOUCH_SETTLE_MS);
    };

    const handleSelectionChange = () => {
      if (!touchActivity.followsRecentTouch()) {
        return;
      }
      scheduleTouchCheck(TOUCH_SETTLE_MS);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("touchcancel", handleTouchCancel);
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      scheduler.cancel();
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("touchcancel", handleTouchCancel);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchstart", handleTouchStart);
    };
  }, [containerRef, disabled, touchActivity]);
}
