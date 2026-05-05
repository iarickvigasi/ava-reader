import { useEffect, useRef, type RefObject } from "react";

export type ReaderSelection = {
  text: string;
  // The live DOM range. The caller may inspect it synchronously (e.g., to
  // compute an offset locator) but must not retain it past the current tick —
  // browsers reuse selection objects and the underlying nodes can re-render.
  range: Range;
};

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
// the selected text. Both mouse and touch are supported. The check is deferred
// to the next tick so the selection has fully settled by the time we read it.
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

    const checkSelection = (clearAfter: boolean) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }

      const text = selection.toString().trim();
      if (text.length === 0) {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const range = selection.getRangeAt(0);
      // Both endpoints (and their common ancestor) must be inside the
      // container. Without this guard a selection that begins in the article
      // and drags into a sibling element would still trigger the panel.
      if (!container.contains(range.commonAncestorContainer)) {
        return;
      }

      onSelectRef.current({ text, range });

      // On touch, the live selection causes the browser's native callout
      // (Copy / Share / Look Up on iOS Safari, Copy / Translate on Chrome
      // Android) to render on top of our panel. We've already captured the
      // text and a locator, so we can drop the live selection without losing
      // anything — color picks and translations operate on the captured
      // values, not on window.getSelection().
      if (clearAfter) {
        selection.removeAllRanges();
      }
    };

    // The selection isn't fully resolved yet at the moment mouseup/touchend
    // fires on some browsers (especially when a double/triple click is
    // expanding the range). A 0ms timeout pushes the read past the browser's
    // own selection update.
    //
    // We also gate on the event target: mouseups whose release point is
    // outside the container (e.g., a click on the AI Comments backdrop, a
    // panel button, or the side rail) must not run the check. Without this
    // gate, a backdrop click would fire onClose and *also* see the lingering
    // DOM selection on the deferred tick — re-opening the panel a moment
    // after closing it.
    const handlePointerEnd = (event: Event) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node) || !container.contains(target)) {
        return;
      }
      const isTouch = event.type === "touchend";
      window.setTimeout(() => checkSelection(isTouch), 0);
    };

    document.addEventListener("mouseup", handlePointerEnd);
    document.addEventListener("touchend", handlePointerEnd);

    return () => {
      document.removeEventListener("mouseup", handlePointerEnd);
      document.removeEventListener("touchend", handlePointerEnd);
    };
  }, [containerRef, disabled]);
}
