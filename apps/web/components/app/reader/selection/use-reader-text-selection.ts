import { useEffect, useRef, type RefObject } from "react";
import { resolveReaderSelection } from "./resolve-reader-selection";
import { createSettleScheduler } from "./settle-scheduler";
import {
  IMMEDIATE_SETTLE_MS,
  TOUCH_RECENCY_MS,
  TOUCH_SETTLE_MS,
} from "./timing";
import type { ReaderSelection } from "./types";

type UseReaderTextSelectionParams = {
  // The element whose contents count as "selectable text" for the panel. Only
  // selections wholly inside this element fire the callback — selections in the
  // open AI Comments panel itself, or in the surrounding chrome, are ignored.
  containerRef: RefObject<HTMLElement | null>;
  // Called after a selection settles with non-empty trimmed text.
  onSelectText: (selection: ReaderSelection) => void;
  // When true, the hook is dormant. Used to switch off selection-driven open
  // logic during bootstrapping or when the reader is masked.
  disabled?: boolean;
};

// Listens for the user finishing a selection inside `containerRef` and reports
// the selected text. Mouse capture runs on the next tick; touch capture also
// follows touchcancel/selectionchange so native long-press takeover can settle.
export function useReaderTextSelection({
  containerRef,
  onSelectText,
  disabled = false,
}: UseReaderTextSelectionParams) {
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

    let touchStartedInside = false;
    let lastReaderTouchStartedAt = Number.NEGATIVE_INFINITY;
    const scheduler = createSettleScheduler(window);

    const checkSelection = (dropLiveSelection: boolean) => {
      const selection = window.getSelection();
      const container = containerRef.current;
      const readerSelection = resolveReaderSelection(selection, container);
      if (!readerSelection) {
        return;
      }

      onSelectRef.current(readerSelection);

      // On touch, the live selection causes the browser's native callout
      // (Copy / Share / Look Up on iOS Safari, Copy / Translate on Chrome
      // Android) to render on top of our panel. We've already captured the
      // text and a locator, so we can drop the live selection without losing
      // anything — color picks and translations operate on the captured
      // values, not on window.getSelection().
      if (dropLiveSelection && selection) {
        selection.removeAllRanges();
      }
    };

    // Touch-origin checks drop the live selection (to hide the native callout)
    // and skip if a fresh touch has started in the meantime — otherwise we'd
    // read a selection the user is still building.
    const scheduleTouchCheck = (delay: number) => {
      scheduler.schedule(delay, () => {
        if (touchStartedInside) {
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

    // The selection isn't fully resolved when mouseup/touchend fires on some
    // browsers. Deferring the read lets the browser finish its own update;
    // canceled touch gestures receive a longer settlement window below.
    //
    // We also gate on the event target: mouseups whose release point is
    // outside the container (e.g., a click on the AI Comments backdrop, a
    // panel button, or the side rail) must not run the check. Without this
    // gate, a backdrop click would fire onClose and *also* see the lingering
    // DOM selection on the deferred tick — re-opening the panel a moment
    // after closing it.
    const isInsideReader = (target: EventTarget | null) => {
      const container = containerRef.current;
      if (!container) {
        return false;
      }
      return target instanceof Node && container.contains(target);
    };

    // A selectionchange/contextmenu counts as reader-driven while a reader
    // touch is in progress, or briefly after one ended (the browser settles
    // the selection asynchronously).
    const followsRecentReaderTouch = () =>
      touchStartedInside ||
      Date.now() - lastReaderTouchStartedAt <= TOUCH_RECENCY_MS;

    const handleMouseUp = (event: MouseEvent) => {
      if (!isInsideReader(event.target)) {
        return;
      }
      scheduleMouseCheck();
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartedInside = isInsideReader(event.target);
      if (touchStartedInside) {
        lastReaderTouchStartedAt = Date.now();
      }
    };

    const handleTouchEnd = () => {
      if (!touchStartedInside) {
        return;
      }
      touchStartedInside = false;
      scheduleTouchCheck(IMMEDIATE_SETTLE_MS);
    };

    const handleTouchCancel = () => {
      if (!touchStartedInside) {
        return;
      }
      touchStartedInside = false;
      scheduleTouchCheck(TOUCH_SETTLE_MS);
    };

    const handleSelectionChange = () => {
      if (!followsRecentReaderTouch()) {
        return;
      }
      scheduleTouchCheck(TOUCH_SETTLE_MS);
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (!isInsideReader(event.target)) {
        return;
      }
      if (followsRecentReaderTouch()) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("touchcancel", handleTouchCancel);
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      scheduler.cancel();
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("touchcancel", handleTouchCancel);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchstart", handleTouchStart);
    };
  }, [containerRef, disabled]);
}
