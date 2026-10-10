import { useEffect } from "react";
import { isInteractiveTarget } from "../../shared/utils";
import type { PageStepControls } from "./use-page-stepper";

import { pageKeyDirection } from "./page-key-direction";

// Arrow-key page turning. ArrowRight → next, ArrowLeft → previous. Ignores
// keypresses while a panel is open or focus is inside an interactive target
// (input, button, etc.).
export function useKeyboardPageNavigation({
  goToNextPage,
  goToPreviousPage,
  isPanelOpen,
}: PageStepControls & { isPanelOpen: boolean }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPanelOpen || isInteractiveTarget(event.target)) {
        return;
      }

      const direction = pageKeyDirection(event);
      if (direction === "next") {
        event.preventDefault();
        goToNextPage();
      }

      if (direction === "previous") {
        event.preventDefault();
        goToPreviousPage();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goToNextPage, goToPreviousPage, isPanelOpen]);
}
