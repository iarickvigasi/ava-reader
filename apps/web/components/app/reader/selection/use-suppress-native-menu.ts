import { useEffect, type RefObject } from "react";
import { isInsideReader } from "./is-inside-reader";
import type { TouchActivity } from "./touch-activity";

type UseSuppressNativeMenuParams = {
  containerRef: RefObject<HTMLElement | null>;
  // Read-only here: the capture hook mutates it on touch events.
  touchActivity: TouchActivity;
  disabled: boolean;
};

// Suppresses the browser's context menu for touch-origin long-presses inside
// the reader, so the OS callout doesn't cover the AI Toolbox. Armed only by a
// recent reader touch, so a genuine desktop right-click still opens the menu.
export function useSuppressNativeMenu({
  containerRef,
  touchActivity,
  disabled,
}: UseSuppressNativeMenuParams) {
  useEffect(() => {
    if (disabled) {
      return;
    }
    if (typeof document === "undefined") {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      if (!isInsideReader(event.target, containerRef.current)) {
        return;
      }
      if (touchActivity.followsRecentTouch()) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [containerRef, disabled, touchActivity]);
}
