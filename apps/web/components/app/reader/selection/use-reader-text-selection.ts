import { useEffect, useRef, type RefObject } from "react";
import { createSelectionCapture } from "./capture/create-selection-capture";
import { isIosTouch } from "./ios/is-ios-touch";
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

// Reports the text the user selects inside `containerRef`. Both mouse and
// touch are captured on the tick after the gesture's end event; capture never
// mutates the selection (the AI toolbox owns the drop) — the event
// choreography lives in capture/create-selection-capture.ts.
//
// iOS is not served from here at all: there the article is non-selectable and
// the app runs its own gesture (ios/use-ios-selection, spec 2.6 Behaviour 8),
// so this hook stands down rather than listening for a selection that can
// never appear.
export function useReaderTextSelection({
  containerRef,
  onSelectText,
  disabled = false,
}: UseReaderTextSelectionParams) {
  // Keep the latest callback in a ref so the capture wiring doesn't need to be
  // torn down and re-bound on every render.
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
    if (isIosTouch(window)) {
      return;
    }

    const capture = createSelectionCapture({
      win: window,
      doc: document,
      getContainer: () => containerRef.current,
      onCapture: (selection) => onSelectRef.current(selection),
    });

    return () => {
      capture.destroy();
    };
  }, [containerRef, disabled]);
}
