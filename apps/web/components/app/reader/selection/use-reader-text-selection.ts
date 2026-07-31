import { useEffect, useRef, type RefObject } from "react";
import { isInsideReader } from "./capture/is-inside-reader";
import { resolveReaderSelection } from "./capture/resolve-reader-selection";
import { createSettleScheduler } from "./capture/settle-scheduler";
import { IMMEDIATE_SETTLE_MS } from "./capture/timing";
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

// Reports the text the user selects inside `containerRef`. Both mouse and touch
// are supported; the read is deferred so the selection has settled by the time
// we look at it. The browser's own selection UI is left alone.
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

    // Touch-origin checks drop the live selection (to hide the native callout).
    const scheduleTouchCheck = () => {
      scheduler.schedule(IMMEDIATE_SETTLE_MS, () => {
        checkSelection(true);
      });
    };

    // Mouse-origin checks keep it — desktop has no native callout collision.
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

    // touchend reports the node the finger went down on, so this gate also
    // covers gestures that started outside the reader.
    const handleTouchEnd = (event: TouchEvent) => {
      if (!isInsideReader(event.target, containerRef.current)) {
        return;
      }
      scheduleTouchCheck();
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      scheduler.cancel();
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [containerRef, disabled]);
}
