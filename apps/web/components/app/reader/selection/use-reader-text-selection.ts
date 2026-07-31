import { useRef, type RefObject } from "react";
import { createTouchActivity, type TouchActivity } from "./capture/touch-activity";
import type { ReaderSelection } from "./types";
import { useReaderSelectionCapture } from "./capture/use-reader-selection-capture";
import { useSuppressNativeMenu } from "./capture/use-suppress-native-menu";

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

// Reports the text the user selects inside `containerRef`. Composes two
// concerns over a single touch-activity tracker: capturing the settled
// selection, and suppressing the native touch callout so it can't cover the
// panel. The tracker is shared so the menu hook can tell whether a contextmenu
// followed a reader touch (mobile) or a desktop right-click.
export function useReaderTextSelection({
  containerRef,
  onSelectText,
  disabled = false,
}: UseReaderTextSelectionParams) {
  const touchActivityRef = useRef<TouchActivity | null>(null);
  touchActivityRef.current ??= createTouchActivity();
  const touchActivity = touchActivityRef.current;

  useReaderSelectionCapture({
    containerRef,
    touchActivity,
    onSelectText,
    disabled,
  });

  useSuppressNativeMenu({ containerRef, touchActivity, disabled });
}
